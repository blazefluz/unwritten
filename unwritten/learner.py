"""The learning loop: observe → hypothesize → check → revise → predict → ask.

Muse Spark does the perception and the hypothesis work. Code does the checking:
every accuracy number in the notebook is computed here, never self-reported.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from .client import ModelClient
from .prompts import (
    OBSERVE_SCHEMA, QUESTIONS_SCHEMA, RULES_SCHEMA,
    answers_prompt, hypothesize_prompt, observe_prompt, questions_prompt, revise_prompt,
)
from .rules import Event, OneRBaseline, RuleSet, coverage, score

Log = Callable[[str], None]


@dataclass
class Attempt:
    round: int
    ruleset: dict[str, Any]
    reasoning: str
    train_accuracy: float
    mistakes: list[dict[str, Any]]
    suspects: list[dict[str, Any]]


@dataclass
class LabResult:
    domain: str
    source: str
    observation: dict[str, Any]
    train: list[Event]
    test: list[Event]
    attempts: list[Attempt] = field(default_factory=list)
    final: RuleSet | None = None
    suspects: list[dict[str, Any]] = field(default_factory=list)
    predictions: list[dict[str, Any]] = field(default_factory=list)
    test_accuracy: float = 0.0
    baseline_description: str = ""
    baseline_test_accuracy: float = 0.0
    questions: list[dict[str, Any]] = field(default_factory=list)
    revisions: list[dict[str, Any]] = field(default_factory=list)  # one per batch of expert answers
    synthetic: bool = False  # hand-written data and scripted replies, not model output

    def to_dict(self) -> dict[str, Any]:
        return {
            "domain": self.domain,
            "source": self.source,
            "observation": self.observation,
            "split": {"train": [e.index for e in self.train],
                      "test": [e.index for e in self.test]},
            "attempts": [a.__dict__ for a in self.attempts],
            "final_rules": self.final.to_dict() if self.final else None,
            "suspect_events": self.suspects,
            "predictions": self.predictions,
            "test_accuracy": self.test_accuracy,
            "baseline": {"description": self.baseline_description,
                         "test_accuracy": self.baseline_test_accuracy},
            "questions": self.questions,
            "revisions": self.revisions,
            "synthetic": self.synthetic,
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "LabResult":
        events = {e.index: e for e in map(Event.from_dict, d["observation"]["events"])}
        return cls(
            domain=d["domain"], source=d["source"], observation=d["observation"],
            train=[events[i] for i in d["split"]["train"]],
            test=[events[i] for i in d["split"]["test"]],
            attempts=[Attempt(**a) for a in d["attempts"]],
            final=RuleSet.from_dict(d["final_rules"]) if d.get("final_rules") else None,
            suspects=d.get("suspect_events", []),
            predictions=d["predictions"], test_accuracy=d["test_accuracy"],
            baseline_description=d["baseline"]["description"],
            baseline_test_accuracy=d["baseline"]["test_accuracy"],
            questions=d.get("questions", []), revisions=d.get("revisions", []),
            synthetic=d.get("synthetic", False),
        )


def observe(client: ModelClient, video: str, domain: str, context: str = "") -> dict[str, Any]:
    """Ask Muse Spark to log every event in the video."""
    obs = client.ask_json(observe_prompt(domain, context), OBSERVE_SCHEMA,
                          name="observation_log", video=video)
    obs["events"] = sorted(obs.get("events", []), key=lambda e: (e["time_start"], e["index"]))
    for i, ev in enumerate(obs["events"]):  # re-index after sorting
        ev["index"] = i
    return obs


def chronological_split(events: list[Event], train_fraction: float, min_test: int = 3
                        ) -> tuple[list[Event], list[Event]]:
    """Learn from the first part of the video, predict the rest.

    A time-based split (not random) mirrors the demo claim: having watched the first
    N items, the system predicts where the next ones will go.
    """
    n = len(events)
    if n < min_test + 3:
        raise ValueError(f"Need at least {min_test + 3} events to learn and test; got {n}.")
    cut = max(3, min(n - min_test, round(n * train_fraction)))
    return events[:cut], events[cut:]


def run_lab(
    client: ModelClient,
    observation: dict[str, Any],
    domain: str = "sorting",
    source: str = "",
    train_fraction: float = 0.6,
    max_rounds: int = 3,
    min_confidence: float = 0.0,
    log: Log = print,
) -> LabResult:
    events = [Event.from_dict(e) for e in observation["events"]]
    usable = [e for e in events if e.confidence >= min_confidence]
    if len(usable) < len(events):
        log(f"Ignoring {len(events) - len(usable)} low-confidence observation(s).")
    train, test = chronological_split(usable, train_fraction)
    result = LabResult(domain, source, observation, train, test)
    log(f"{len(usable)} events: learning from {len(train)}, holding out {len(test)} to predict.")

    glossary = observation.get("attribute_glossary", [])
    train_dicts = [e.to_dict() for e in train]

    # 1. Hypothesize, 2. check in code, 3. revise on counterexamples
    proposal = client.ask_json(hypothesize_prompt(domain, train_dicts, glossary),
                               RULES_SCHEMA, name="rules")
    best_accuracy = -1.0
    for round_no in range(1, max_rounds + 1):
        ruleset = RuleSet.from_dict(proposal)
        suspects = proposal.get("suspect_events", [])
        suspect_ids = {s["index"] for s in suspects}
        checked = score(ruleset, train)
        unexplained = [m for m in checked.mistakes if m["index"] not in suspect_ids]
        result.attempts.append(Attempt(round_no, ruleset.to_dict(), proposal.get("reasoning", ""),
                                       checked.accuracy, checked.mistakes, suspects))
        log(f"Round {round_no}: {len(ruleset.rules)} rule(s), explains "
            f"{checked.correct}/{checked.total} training events"
            f"{f', {len(suspect_ids)} flagged as suspect' if suspect_ids else ''}.")
        # A revision can make things worse: keep the best round, judged on training data only.
        if checked.accuracy >= best_accuracy:
            best_accuracy, result.final, result.suspects = checked.accuracy, ruleset, suspects
        if not unexplained or round_no == max_rounds:
            break
        proposal = client.ask_json(
            revise_prompt(domain, train_dicts, ruleset.to_dict(), unexplained),
            RULES_SCHEMA, name="rules")

    # 4. Predict held-out events with the rules (code applies them, not the model)
    assert result.final is not None
    _predict_held_out(result)

    # 5. Honest baseline: best single-attribute lookup table, no AI
    baseline = OneRBaseline().fit(train)
    result.baseline_description = baseline.describe()
    result.baseline_test_accuracy = baseline.accuracy(test)
    log(f"Held-out prediction: {sum(p['correct'] for p in result.predictions)}/{len(test)} correct "
        f"({result.test_accuracy:.0%}); one-attribute baseline {result.baseline_test_accuracy:.0%}.")

    # 6. Ask about the cases the evidence doesn't cover
    _ask_questions(client, result)
    log(f"{len(result.questions)} question(s) for the expert.")
    return result


def _predict_held_out(result: LabResult) -> None:
    assert result.final is not None
    result.predictions = []
    for ev in result.test:
        predicted, fired, certain = result.final.apply(ev.attributes)
        result.predictions.append({
            "index": ev.index, "item": ev.item, "time_start": ev.time_start,
            "attributes": ev.attributes, "predicted": predicted, "actual": ev.outcome,
            "correct": predicted == ev.outcome, "fired_rule": fired, "certain": certain,
        })
    result.test_accuracy = sum(p["correct"] for p in result.predictions) / len(result.test)


def _ask_questions(client: ModelClient, result: LabResult) -> None:
    assert result.final is not None
    cov = coverage(result.final, result.train + result.test)
    qs = client.ask_json(questions_prompt(result.domain, result.final.to_dict(), cov),
                         QUESTIONS_SCHEMA, name="questions")
    result.questions = qs.get("questions", [])


def apply_answers(
    client: ModelClient,
    result: LabResult,
    answers: list[dict[str, Any]],
    log: Log = print,
) -> LabResult:
    """Revise the rules from the expert's answers, then re-score them in code.

    The model sees training events only, so the held-out score stays a real test.
    Each answer holds the question text, the probe and the expert's answer.
    """
    assert result.final is not None
    if not answers:
        raise ValueError("No answers to apply.")
    before = score(result.final, result.train)
    before_rules, before_test = result.final.to_dict(), result.test_accuracy
    proposal = client.ask_json(
        answers_prompt(result.domain, [e.to_dict() for e in result.train], before_rules, answers),
        RULES_SCHEMA, name="rules")
    result.final = RuleSet.from_dict(proposal)
    result.suspects = proposal.get("suspect_events", [])
    _predict_held_out(result)
    after = score(result.final, result.train)
    result.revisions.append({
        "answers": answers, "reasoning": proposal.get("reasoning", ""),
        "rules_before": before_rules,
        "train_accuracy_before": before.accuracy, "train_accuracy_after": after.accuracy,
        "test_accuracy_before": before_test, "test_accuracy_after": result.test_accuracy,
    })
    log(f"Expert answers applied: training {before.accuracy:.0%} → {after.accuracy:.0%}, "
        f"held-out {before_test:.0%} → {result.test_accuracy:.0%}.")
    _ask_questions(client, result)
    log(f"{len(result.questions)} new question(s) for the expert.")
    return result
