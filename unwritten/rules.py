"""Rule representation and deterministic evaluation.

The model *proposes* rules; this module *checks* them. Rules are an ordered
decision list: the first rule whose conditions all hold decides the outcome,
otherwise the default applies. Scoring never asks the model anything.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any

UNKNOWN = "unknown"
OPS = ("eq", "neq", "lt", "lte", "gt", "gte", "in", "not_in", "contains")


def norm(value: Any) -> str:
    return str(value).strip().lower()


def _num(value: str) -> float | None:
    try:
        return float(value.replace(",", "").rstrip("kgcm% "))
    except (ValueError, AttributeError):
        return None


@dataclass
class Event:
    index: int
    item: str
    attributes: dict[str, str]
    outcome: str
    time_start: float = 0.0
    time_end: float = 0.0
    confidence: float = 1.0
    evidence: str = ""

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "Event":
        attrs = d.get("attributes", {})
        if isinstance(attrs, list):  # schema form: [{"name":..,"value":..}]
            attrs = {a["name"]: a["value"] for a in attrs}
        return cls(
            index=int(d["index"]),
            item=d.get("item", ""),
            attributes={norm(k): norm(v) for k, v in attrs.items()},
            outcome=norm(d["outcome"]),
            time_start=float(d.get("time_start", 0) or 0),
            time_end=float(d.get("time_end", 0) or 0),
            confidence=float(d.get("confidence", 1) or 1),
            evidence=d.get("evidence", ""),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "index": self.index,
            "item": self.item,
            "attributes": self.attributes,
            "outcome": self.outcome,
            "time_start": self.time_start,
            "time_end": self.time_end,
            "confidence": self.confidence,
            "evidence": self.evidence,
        }


@dataclass
class Condition:
    attribute: str
    op: str
    value: str

    def holds(self, attrs: dict[str, str]) -> bool | None:
        """True/False, or None when the attribute is missing or unknown."""
        actual = attrs.get(norm(self.attribute))
        if actual is None or actual == UNKNOWN:
            return None
        expected = norm(self.value)
        op = self.op
        if op in ("in", "not_in"):
            options = {norm(v) for v in expected.split("|")}
            return (actual in options) == (op == "in")
        if op == "contains":
            return expected in actual
        if op in ("lt", "lte", "gt", "gte"):
            a, e = _num(actual), _num(expected)
            if a is None or e is None:
                return None
            return {"lt": a < e, "lte": a <= e, "gt": a > e, "gte": a >= e}[op]
        if op == "neq":
            return actual != expected
        return actual == expected  # eq and anything unrecognised

    def __str__(self) -> str:
        sym = {"eq": "=", "neq": "≠", "lt": "<", "lte": "≤", "gt": ">", "gte": "≥",
               "in": "in", "not_in": "not in", "contains": "contains"}.get(self.op, self.op)
        return f"{self.attribute} {sym} {self.value}"


@dataclass
class Rule:
    conditions: list[Condition]
    outcome: str
    why: str = ""

    def __str__(self) -> str:
        cond = " AND ".join(str(c) for c in self.conditions) or "always"
        return f"IF {cond} → {self.outcome}"


@dataclass
class RuleSet:
    rules: list[Rule]
    default: str
    summary: str = ""

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "RuleSet":
        rules = [
            Rule(
                conditions=[Condition(c["attribute"], c.get("op", "eq"), str(c["value"]))
                            for c in r.get("if", [])],
                outcome=norm(r["then"]),
                why=r.get("why", ""),
            )
            for r in d.get("rules", [])
        ]
        return cls(rules=rules, default=norm(d.get("default", UNKNOWN)),
                   summary=d.get("summary", ""))

    def to_dict(self) -> dict[str, Any]:
        return {
            "rules": [
                {"if": [c.__dict__ for c in r.conditions], "then": r.outcome, "why": r.why}
                for r in self.rules
            ],
            "default": self.default,
            "summary": self.summary,
        }

    def apply(self, attrs: dict[str, str]) -> tuple[str, int | None, bool]:
        """Return (outcome, index of firing rule or None for default, certain?).

        `certain` is False when an unknown attribute could have changed the result.
        """
        certain = True
        for i, rule in enumerate(self.rules):
            results = [c.holds(attrs) for c in rule.conditions]
            if all(r is True for r in results):
                return rule.outcome, i, certain
            if not any(r is False for r in results):
                certain = False  # some condition was undetermined
        return self.default, None, certain


@dataclass
class Score:
    total: int
    correct: int
    mistakes: list[dict[str, Any]] = field(default_factory=list)
    rule_support: dict[int | None, int] = field(default_factory=dict)

    @property
    def accuracy(self) -> float:
        return self.correct / self.total if self.total else 0.0


def score(ruleset: RuleSet, events: list[Event]) -> Score:
    correct, mistakes, support = 0, [], Counter()
    for ev in events:
        predicted, fired, certain = ruleset.apply(ev.attributes)
        support[fired] += 1
        if predicted == ev.outcome:
            correct += 1
        else:
            mistakes.append({
                "index": ev.index, "item": ev.item, "attributes": ev.attributes,
                "predicted": predicted, "actual": ev.outcome,
                "fired_rule": fired, "certain": certain,
            })
    return Score(len(events), correct, mistakes, dict(support))


class OneRBaseline:
    """Classic one-attribute baseline (Holte's OneR): no AI, honest comparison."""

    def __init__(self) -> None:
        self.attribute: str | None = None
        self.table: dict[str, str] = {}
        self.fallback = UNKNOWN

    def fit(self, events: list[Event]) -> "OneRBaseline":
        if not events:
            return self
        self.fallback = Counter(e.outcome for e in events).most_common(1)[0][0]
        best = (-1, None, {})
        attributes = sorted({a for e in events for a in e.attributes})
        for attr in attributes:
            by_value: dict[str, Counter] = defaultdict(Counter)
            for e in events:
                by_value[e.attributes.get(attr, UNKNOWN)][e.outcome] += 1
            table = {v: c.most_common(1)[0][0] for v, c in by_value.items()}
            hits = sum(c[table[v]] for v, c in by_value.items())
            if hits > best[0]:
                best = (hits, attr, table)
        _, self.attribute, self.table = best
        return self

    def predict(self, attrs: dict[str, str]) -> str:
        if self.attribute is None:
            return self.fallback
        return self.table.get(attrs.get(self.attribute, UNKNOWN), self.fallback)

    def accuracy(self, events: list[Event]) -> float:
        if not events:
            return 0.0
        return sum(self.predict(e.attributes) == e.outcome for e in events) / len(events)

    def describe(self) -> str:
        if self.attribute is None:
            return f"always '{self.fallback}'"
        pairs = ", ".join(f"{v}→{o}" for v, o in sorted(self.table.items()))
        return f"by {self.attribute}: {pairs}"


def coverage(ruleset: RuleSet, events: list[Event]) -> dict[str, Any]:
    """Facts computed in code that tell the model where its evidence is thin."""
    support = Counter(ruleset.apply(e.attributes)[1] for e in events)
    values_seen: dict[str, set[str]] = defaultdict(set)
    for e in events:
        for k, v in e.attributes.items():
            values_seen[k].add(v)
    thin = [
        {"rule": i, "text": str(r), "supporting_events": support.get(i, 0)}
        for i, r in enumerate(ruleset.rules) if support.get(i, 0) <= 1
    ]
    numeric_gaps = []
    for attr, vals in values_seen.items():
        nums = sorted(n for n in (_num(v) for v in vals) if n is not None)
        for r in ruleset.rules:
            for c in r.conditions:
                if norm(c.attribute) == attr and c.op in ("lt", "lte", "gt", "gte"):
                    t = _num(norm(c.value))
                    if t is None or not nums:
                        continue
                    below = [n for n in nums if n < t]
                    above = [n for n in nums if n >= t]
                    numeric_gaps.append({
                        "attribute": attr, "threshold": t,
                        "closest_below": max(below) if below else None,
                        "closest_above": min(above) if above else None,
                    })
    return {
        "default_used_by": support.get(None, 0),
        "thinly_supported_rules": thin,
        "values_seen": {k: sorted(v) for k, v in values_seen.items()},
        "threshold_gaps": numeric_gaps,
    }
