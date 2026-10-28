"""Offline tests: a scripted fake stands in for Muse Spark, so the checking,
revision and prediction logic can be verified without API calls."""
import json
from pathlib import Path

import pytest

from unwritten.client import _extract_json
from unwritten.learner import chronological_split, run_lab
from unwritten.report import render
from unwritten.rules import Condition, Event, OneRBaseline, RuleSet, coverage, score

FIXTURE = Path(__file__).parent.parent / "fixtures" / "synthetic_parcels.observations.json"

INCOMPLETE = {  # misses the "fragile" rule on purpose
    "reasoning": "Damaged items go to returns; heavy ones to the heavy cart.",
    "rules": [
        {"if": [{"attribute": "damaged", "op": "eq", "value": "yes"}], "then": "returns", "why": "can't ship damaged"},
        {"if": [{"attribute": "weight_kg", "op": "gt", "value": "5"}], "then": "heavy_cart", "why": "lifting limit"},
    ],
    "default": "standard_bin", "summary": "first guess", "suspect_events": [],
}
FIXED = {
    "reasoning": "Counterexamples were all fragile-labelled, so added a fragile rule after weight.",
    "rules": INCOMPLETE["rules"] + [
        {"if": [{"attribute": "label", "op": "eq", "value": "fragile"}], "then": "fragile_shelf", "why": "handle gently"},
    ],
    "default": "standard_bin", "summary": "damaged > heavy > fragile > standard", "suspect_events": [],
}
QUESTIONS = {"questions": [{"question": "Where does a 5.2 kg box go?", "probe": "a 5.2 kg plain box",
                            "why_it_matters": "pins the weight threshold", "rule_affected": 1}]}


class FakeClient:
    def __init__(self, replies):
        self.replies, self.prompts = list(replies), []

    def upload_video(self, path):
        return "file-fake"

    def ask_json(self, prompt, schema, name, video=None):
        self.prompts.append((name, prompt))
        return json.loads(json.dumps(self.replies.pop(0)))


def obs():
    return json.loads(FIXTURE.read_text())


def test_conditions():
    a = {"weight_kg": "5.5", "label": "fragile", "damaged": "unknown"}
    assert Condition("weight_kg", "gt", "5").holds(a) is True
    assert Condition("weight_kg", "lte", "5 kg").holds(a) is False
    assert Condition("label", "in", "Fragile|glass").holds(a) is True
    assert Condition("damaged", "eq", "yes").holds(a) is None  # unknown is not False
    assert Condition("colour", "eq", "red").holds(a) is None


def test_unknown_attribute_marks_prediction_uncertain():
    rs = RuleSet.from_dict(FIXED)
    outcome, fired, certain = rs.apply({"damaged": "unknown", "weight_kg": "1", "label": "none"})
    assert outcome == "standard_bin" and fired is None and certain is False


def test_correct_rules_score_perfectly():
    events = [Event.from_dict(e) for e in obs()["events"]]
    assert score(RuleSet.from_dict(FIXED), events).accuracy == 1.0
    s = score(RuleSet.from_dict(INCOMPLETE), events)
    assert s.accuracy < 1.0 and all(m["actual"] == "fragile_shelf" for m in s.mistakes)


def test_loop_revises_on_counterexamples_then_predicts():
    fake = FakeClient([INCOMPLETE, FIXED, QUESTIONS])
    result = run_lab(fake, obs(), log=lambda *_: None)
    assert [n for n, _ in fake.prompts] == ["rules", "rules", "questions"]
    assert "counterexample" in fake.prompts[1][1].lower()  # revision saw the mistakes
    assert len(result.attempts) == 2
    assert result.attempts[0].train_accuracy < 1.0 and result.attempts[1].train_accuracy == 1.0
    assert result.test_accuracy == 1.0
    assert len(result.train) + len(result.test) == 16
    # held-out events come strictly after training events in time
    assert max(e.time_start for e in result.train) < min(e.time_start for e in result.test)
    assert result.questions[0]["rule_affected"] == 1
    assert "Unwritten" in render(result)


def test_suspect_events_stop_revision_without_hiding_them():
    flagged = dict(INCOMPLETE)
    events = [Event.from_dict(e) for e in obs()["events"]]
    train, _ = chronological_split(events, 0.6)
    wrong = [m["index"] for m in score(RuleSet.from_dict(INCOMPLETE), train).mistakes]
    flagged["suspect_events"] = [{"index": i, "reason": "sticker unclear"} for i in wrong]
    fake = FakeClient([flagged, QUESTIONS])
    result = run_lab(fake, obs(), log=lambda *_: None)
    assert len(result.attempts) == 1  # no revision needed: all mistakes flagged
    assert result.attempts[0].mistakes  # but the mistakes are still recorded
    assert result.test_accuracy < 1.0  # and the held-out test exposes the missing rule


def test_baseline_and_coverage():
    events = [Event.from_dict(e) for e in obs()["events"]]
    train, test = chronological_split(events, 0.6)
    base = OneRBaseline().fit(train)
    assert base.attribute in {"damaged", "label", "material", "weight_kg"}
    assert 0 <= base.accuracy(test) <= 1
    cov = coverage(RuleSet.from_dict(FIXED), events)
    gap = cov["threshold_gaps"][0]
    assert gap["threshold"] == 5 and gap["closest_below"] == 4.0 and gap["closest_above"] == 5.5


def test_split_needs_enough_events():
    events = [Event.from_dict(e) for e in obs()["events"]][:4]
    with pytest.raises(ValueError):
        chronological_split(events, 0.6)


def test_extract_json_tolerates_wrapping():
    assert _extract_json('Here:\n```json\n{"a": 1}\n```') == {"a": 1}
    assert _extract_json('result {"a": 2} done') == {"a": 2}
