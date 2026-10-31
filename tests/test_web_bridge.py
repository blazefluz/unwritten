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
