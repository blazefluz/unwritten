"""Verify the local UI bridge without uploads or paid model calls."""
import json

import pytest

from tests.test_engine import FakeClient
from tests.test_workflow import OBS, HYP
from unwritten import web_bridge


def test_bridge_saves_observations_and_returns_workflow(tmp_path, monkeypatch):
    fake = FakeClient([OBS, HYP])
    monkeypatch.setattr(web_bridge, "MetaClient", lambda: fake)
    request = {"video": "synthetic.mp4", "task": "Synthetic task", "source": "synthetic.mp4",
               "observations": str(tmp_path / "observations.json"),
               "output": str(tmp_path / "workflow.json")}
    result = web_bridge.run(request)
    assert result["kind"] == "workflow_analysis"
    assert json.loads((tmp_path / "observations.json").read_text())["events"] == OBS["events"]
    assert json.loads((tmp_path / "workflow.json").read_text()) == result


def test_bridge_keeps_observations_when_later_reasoning_fails(tmp_path, monkeypatch):
    monkeypatch.setattr(web_bridge, "MetaClient", lambda: FakeClient([OBS]))
    request = {"video": "synthetic.mp4", "task": "Synthetic task", "source": "synthetic.mp4",
               "observations": str(tmp_path / "observations.json"),
               "output": str(tmp_path / "workflow.json")}
    with pytest.raises(IndexError):
        web_bridge.run(request)
    assert (tmp_path / "observations.json").exists()
    assert not (tmp_path / "workflow.json").exists()


import copy
from tests.test_workflow import REF, REVIEW
from unwritten.workflow import analyze

def test_answer_review_retains_history_and_original_observations(monkeypatch):
    previous = analyze(FakeClient([HYP, REVIEW]), task="Synthetic task",
                       observation=OBS, references=[REF])
    original = copy.deepcopy(previous)
    fake = FakeClient([HYP, REVIEW])
    monkeypatch.setattr(web_bridge, "MetaClient", lambda: fake)
    result = web_bridge.run({"operation": "review", "workflow": previous,
                             "answers": {"h1": "Synthetic expert testimony"}})
    assert len(result["attempts"]) == 2
    assert result["attempts"][0] == previous["attempts"][0]
    assert result["events"] == original["events"]
    assert previous == original
    assert "Synthetic expert testimony" in fake.prompts[0][1]
    assert result["expert_answers"] == {"h1": "Synthetic expert testimony"}


def test_decision_bridge_uses_the_same_deterministic_evaluator(monkeypatch):
    events = [{**OBS["events"][0], "id": f"event-{i}", "time_start": i*10,
               "time_end": i*10+2} for i in range(3)]
    fake = FakeClient([{"rules": ["Synthetic rule"]},
        {"action_label": "inspect", "reason": "test", "uncertainty": "test"},
        {"action_label": "", "reason": "test", "uncertainty": "test"}])
    monkeypatch.setattr(web_bridge, "MetaClient", lambda: fake)
    result = web_bridge.run({"operation": "decisions", "observation": {"events": events},
                            "labels": {event["id"]: "inspect" for event in events}})
    assert result["score"] == {"correct": 1, "total": 2, "abstained": 1, "baseline_correct": 2}
