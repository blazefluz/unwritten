"""Prompts and JSON schemas for each step of the learning loop."""
from __future__ import annotations

import json
from typing import Any

from .rules import OPS

# ---------------------------------------------------------------- domains ---
DOMAINS: dict[str, dict[str, str]] = {
    "sorting": {
        "actor": "a person sorting items",
        "event": "one item being picked up and placed into a destination "
                 "(bin, pile, shelf, box, conveyor, etc.)",
        "outcome": "the destination the item was placed in",
        "attributes_hint": "visible properties that could plausibly drive the decision: "
                           "size, colour, material, shape, condition/damage, labels, "
                           "estimated weight, item type, count",
    },
    "sequence": {
        "actor": "a person operating a machine or tool",
        "event": "one action taken by the operator",
        "outcome": "the action taken (e.g. 'press start', 'close lid', 'wait')",
        "attributes_hint": "the visible machine state just before the action: lights, "
                           "display text, lid/door position, previous action, indicators",
    },
    "game": {
        "actor": "people playing a game",
        "event": "one move or turn",
        "outcome": "what the move did (e.g. 'piece captured', 'turn passes', 'legal')",
        "attributes_hint": "visible state before the move: piece type, position, "
                           "dice value, card shown, whose turn",
    },
}


def domain_text(domain: str) -> dict[str, str]:
    if domain not in DOMAINS:
        raise ValueError(f"Unknown domain '{domain}'. Choose: {', '.join(DOMAINS)}")
    return DOMAINS[domain]


# ---------------------------------------------------------------- schemas ---
OBSERVE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "outcomes": {"type": "array", "items": {"type": "string"}},
        "attribute_glossary": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "meaning": {"type": "string"},
                },
                "required": ["name", "meaning"],
            },
        },
        "events": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "index": {"type": "integer"},
                    "time_start": {"type": "number"},
                    "time_end": {"type": "number"},
                    "item": {"type": "string"},
                    "attributes": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "value": {"type": "string"},
                            },
                            "required": ["name", "value"],
                        },
                    },
                    "outcome": {"type": "string"},
                    "confidence": {"type": "number"},
                    "evidence": {"type": "string"},
                },
                "required": ["index", "time_start", "time_end", "item",
                             "attributes", "outcome", "confidence", "evidence"],
            },
        },
    },
    "required": ["outcomes", "attribute_glossary", "events"],
}

RULES_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "reasoning": {"type": "string"},
        "rules": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "if": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "attribute": {"type": "string"},
                                "op": {"type": "string", "enum": list(OPS)},
                                "value": {"type": "string"},
                            },
                            "required": ["attribute", "op", "value"],
                        },
                    },
                    "then": {"type": "string"},
                    "why": {"type": "string"},
                },
                "required": ["if", "then", "why"],
            },
        },
        "default": {"type": "string"},
        "summary": {"type": "string"},
        "suspect_events": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "index": {"type": "integer"},
                    "reason": {"type": "string"},
                },
                "required": ["index", "reason"],
            },
        },
    },
    "required": ["reasoning", "rules", "default", "summary", "suspect_events"],
}

QUESTIONS_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "probe": {"type": "string"},
                    "why_it_matters": {"type": "string"},
                    "rule_affected": {"type": "integer"},
                },
                "required": ["question", "probe", "why_it_matters", "rule_affected"],
            },
        },
    },
    "required": ["questions"],
}


# ---------------------------------------------------------------- prompts ---
def observe_prompt(domain: str, context: str = "") -> str:
    d = domain_text(domain)
    return f"""You are a careful field observer. The video shows {d['actor']}.

Log EVERY {d['event']} in chronological order. For each one record:
- time_start / time_end in seconds from the start of the video
- item: a short neutral description
- attributes: {d['attributes_hint']}
- outcome: {d['outcome']}
- confidence (0-1) that you saw the attributes and outcome correctly
- evidence: what in the frames shows the outcome

Rules for the log:
1. Use ONE consistent set of attribute names for every event (snake_case),
   and record every attribute for every event. If you cannot see a value, write "unknown".
   Never guess a value you cannot see.
2. Prefer short categorical values ("small", "red", "cardboard") or numbers with units.
3. Use the same outcome label every time for the same destination.
4. Do NOT infer the sorting rule yet. Just record what you observe.
5. Define every attribute name in attribute_glossary.
{('Extra context from the user: ' + context) if context else ''}"""


def _events_table(events: list[dict[str, Any]]) -> str:
    return json.dumps(events, indent=1, ensure_ascii=False)


def hypothesize_prompt(domain: str, events: list[dict[str, Any]], glossary: list[dict]) -> str:
    d = domain_text(domain)
    return f"""You are reverse-engineering the unwritten rules of {d['actor']}.
Below is an observation log. Each event has attributes and an outcome ({d['outcome']}).

Find the SIMPLEST ordered decision list that explains the outcomes:
- Rules are checked top to bottom; the first rule whose conditions ALL hold decides.
- If none fires, `default` applies.
- Allowed ops: {', '.join(OPS)}. For `in`/`not_in`, separate options with "|".
- Use only attribute names that appear in the log.
- Prefer few rules with clear real-world meaning over many rules that memorise events.
- An expert's real rule usually has a reason; put it in `why`.
- If a few events contradict an otherwise clean rule, they may be observation
  errors or genuine exceptions. List them in suspect_events with a reason rather than
  adding special-case rules for them.

Attribute glossary:
{json.dumps(glossary, ensure_ascii=False)}

Observation log:
{_events_table(events)}"""


def revise_prompt(
    domain: str,
    events: list[dict[str, Any]],
    current: dict[str, Any],
    mistakes: list[dict[str, Any]],
) -> str:
    d = domain_text(domain)
    return f"""You proposed rules for {d['actor']}. A deterministic checker applied them
to the observations and found {len(mistakes)} event(s) where your rules predict the
wrong outcome.

Your current rules:
{json.dumps(current, indent=1, ensure_ascii=False)}

Counterexamples (predicted vs actual):
{json.dumps(mistakes, indent=1, ensure_ascii=False)}

Full observation log for reference:
{_events_table(events)}

Revise the rules. Either fix the rules so they explain these events, or, if an event
looks like an observation error or a one-off exception, list it in suspect_events with
a specific reason. Do not add rules that only fit a single event unless you can state a
plausible real-world reason in `why`. Explain what changed in `reasoning`."""


def questions_prompt(
    domain: str,
    ruleset: dict[str, Any],
    coverage: dict[str, Any],
    max_questions: int = 3,
) -> str:
    d = domain_text(domain)
    return f"""You inferred these rules for {d['actor']}:
{json.dumps(ruleset, indent=1, ensure_ascii=False)}

A checker computed where the evidence is thin:
{json.dumps(coverage, indent=1, ensure_ascii=False)}

Ask the expert at most {max_questions} questions that would most reduce your
uncertainty. Each question must:
- target a specific rule (rule_affected = its index, or -1 for the default),
- include a concrete `probe`: a specific item or situation to show next whose
  outcome would distinguish your current rule from a plausible alternative
  (e.g. an item just above/below a threshold, or an unseen combination),
- explain in why_it_matters what each answer would change.
Prefer questions about thresholds that were never tested close up, rules supported by
one event, and the default branch."""
