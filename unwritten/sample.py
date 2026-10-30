"""A synthetic sample lab for trying the app with no API key and no video.

The observations are hand-written and the replies below are scripted. Pages built
from this are bannered as synthetic; never present them as Muse Spark output.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

SAMPLE_STEM = "sample"
SAMPLE_FIXTURE = Path(__file__).parent.parent / "fixtures" / "synthetic_parcels.observations.json"

_DAMAGED = {"if": [{"attribute": "damaged", "op": "eq", "value": "yes"}], "then": "returns",
            "why": "Damaged parcels cannot ship."}
_HEAVY = {"if": [{"attribute": "weight_kg", "op": "gt", "value": "5"}], "then": "heavy_cart",
          "why": "Heavy parcels go on the cart."}
_FRAGILE = {"if": [{"attribute": "label", "op": "eq", "value": "fragile"}], "then": "fragile_shelf",
            "why": "Fragile parcels are handled separately."}

_FIRST = {"reasoning": "Damaged parcels go to returns and heavy ones to the cart.",
          "rules": [_DAMAGED, _HEAVY], "default": "standard_bin",
          "summary": "Damaged, then heavy, then everything else.", "suspect_events": []}
_REVISED = {"reasoning": "The counterexamples were all labelled fragile, so a fragile rule was added.",
            "rules": [_DAMAGED, _HEAVY, _FRAGILE], "default": "standard_bin",
            "summary": "Damaged first, then heavy, then fragile, then the standard bin.",
            "suspect_events": []}
_AFTER_ANSWER = {"reasoning": "Scripted sample reply: exactly 5 kg now counts as heavy.",
                 "rules": [_DAMAGED, {**_HEAVY, "if": [{"attribute": "weight_kg", "op": "gte", "value": "5"}]},
                           _FRAGILE],
                 "default": "standard_bin",
                 "summary": "Damaged first, then 5 kg or more, then fragile, then the standard bin.",
                 "suspect_events": []}
_QUESTIONS = {"questions": [{
    "question": "Where does a parcel weighing exactly 5 kg go?",
    "probe": "A plain 5 kg cardboard box",
    "why_it_matters": "The clip shows 4 kg and 5.5 kg parcels but nothing between them.",
    "rule_affected": 1,
}]}


class ScriptedClient:
    """Stands in for Muse Spark in the sample only. It ignores what the prompt says."""

    def __init__(self, revising_from_answers: bool = False) -> None:
        self._rules = [_AFTER_ANSWER] if revising_from_answers else [_FIRST, _REVISED]

    def upload_video(self, path: str | Path) -> str:
        raise RuntimeError("The synthetic sample has no video to upload.")

    def ask_json(self, prompt: str, schema: dict[str, Any], name: str,
                 video: str | None = None) -> dict[str, Any]:
        if name == "rules":
            return self._rules.pop(0)
        if name == "questions":
            return _QUESTIONS
        raise ValueError(f"The synthetic sample has no reply for '{name}'.")
