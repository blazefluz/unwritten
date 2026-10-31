"""Synthetic, offline workflow tests; none of these are real video/model results."""
import copy
import json

import pytest

from tests.test_engine import FakeClient
from unwritten.workflow import analyze, check_reviews, load_references, render


OBS = {"kind": "workflow_observations", "source": "synthetic-task.mp4", "events": [{
    "id": "event-1", "time_start": 2, "time_end": 5,
    "action": "Worker moves a marked item to the left tray.",
    "visible_evidence": "A red marker is visible.", "observed_result": "Item in left tray",
    "uncertainties": ["Marker meaning is unknown."],
}]}
HYP = {"hypotheses": [{"id": "h1", "event_ids": ["event-1"],
    "claim": "Marker colour may determine destination.",
    "reasoning": "The marked item was routed left.",
    "alternatives": ["Another property may determine the destination."],
    "expert_question": "h1: What does the red marker mean?"}]}
REF = {"id": "ref-1", "title": "SYNTHETIC reference", "declared_scope": "Synthetic task v1",
       "lines": ["SYNTHETIC TEST REFERENCE — not a real operating procedure.",
                 "Items marked red belong in the left tray."], "sha256": "test"}
REVIEW = {"reviews": [{"hypothesis_id": "h1", "assessment": "supported",
    "explanation": "The sample text describes this routing.",
    "applicable": True, "applicability": "Synthetic task v1 matches the test context.",
    "citations": [{"reference_id": "ref-1", "line_start": 2, "line_end": 2,
                   "quote": REF["lines"][1]}]}]}


def test_general_workflow_observes_before_reference_review_and_saves():
    fake = FakeClient([OBS, HYP, REVIEW])
    saved = []
    result = analyze(fake, task="Synthetic routing demonstration", video="file-fake",
                     references=[REF], on_observed=saved.append)
    assert [name for name, _ in fake.prompts] == [
        "workflow_observations", "workflow_hypotheses", "workflow_review"]
    assert REF["lines"][1] not in fake.prompts[0][1]
    assert saved[0]["kind"] == "workflow_observations"
    assert result["final"]["reviews"][0]["assessment"] == "supported"
    assert result["final"]["reviews"][0]["human_review_required"]


@pytest.mark.parametrize("field,value", [
    ("quote", "Invented text"), ("quote", "Items marked red"),
    ("reference_id", "fake"), ("line_start", 0), ("line_end", 9),
])
def test_fabricated_and_partial_citations_never_support_a_claim(field, value):
    review = copy.deepcopy(REVIEW)
    review["reviews"][0]["citations"][0][field] = value
    checked = check_reviews(HYP["hypotheses"], review, [REF])[0]
    assert checked["assessment"] == "inconclusive"
    assert checked["validation_errors"]


def test_reference_scope_and_applicability_are_required():
    ref = {**REF, "declared_scope": ""}
    assert check_reviews(HYP["hypotheses"], REVIEW, [ref])[0]["assessment"] == "inconclusive"
    review = copy.deepcopy(REVIEW)
    review["reviews"][0]["applicable"] = False
    assert check_reviews(HYP["hypotheses"], review, [REF])[0]["assessment"] == "inconclusive"


def test_revision_preserves_original_conflict_and_observations():
    conflict = copy.deepcopy(REVIEW)
    conflict["reviews"][0]["assessment"] = "conflicts"
    revised = copy.deepcopy(HYP)
    revised["hypotheses"][0]["claim"] = "Routing remains uncertain."
    fake = FakeClient([HYP, conflict, revised, REVIEW])
    result = analyze(fake, task="Synthetic task", observation=OBS, references=[REF])
    assert len(result["attempts"]) == 2
    assert result["attempts"][0]["reviews"][0]["assessment"] == "conflicts"
    assert result["events"] == OBS["events"]
    assert "previous_attempt" in fake.prompts[2][1]


def test_without_references_reuses_observations_and_remains_inconclusive():
    fake = FakeClient([HYP])
    result = analyze(fake, task="Any task", observation=OBS, answers={"h1": "Not sure"})
    assert len(fake.prompts) == 1
    assert result["expert_answers"] == {"h1": "Not sure"}
    assert result["final"]["reviews"][0]["assessment"] == "inconclusive"
    assert "Not sure" in fake.prompts[0][1]


@pytest.mark.parametrize("change", ["duplicate", "nan", "negative", "reversed", "empty"])
def test_bad_observations_fail_before_inference(change):
    obs = copy.deepcopy(OBS)
    if change == "duplicate":
        obs["events"] *= 2
    elif change == "nan":
        obs["events"][0]["time_start"] = float("nan")
    elif change == "negative":
        obs["events"][0]["time_start"] = -1
    elif change == "reversed":
        obs["events"][0]["time_start"] = 10
    else:
        obs["events"] = []
    fake = FakeClient([])
    with pytest.raises(ValueError):
        analyze(fake, task="Any task", observation=obs)
    assert not fake.prompts


def test_unknown_event_link_fails():
    hyp = copy.deepcopy(HYP)
    hyp["hypotheses"][0]["event_ids"] = ["fabricated-event"]
    with pytest.raises(ValueError):
        analyze(FakeClient([hyp]), task="Any task", observation=OBS)


def test_missing_duplicate_or_uncited_review_is_inconclusive():
    for reviews in ([], REVIEW["reviews"] * 2,
                    [{**REVIEW["reviews"][0], "citations": []}]):
        assert check_reviews(HYP["hypotheses"], {"reviews": reviews}, [REF])[0][
            "assessment"] == "inconclusive"


def test_load_references_and_escape_html(tmp_path):
    path = tmp_path / "notes.md"
    path.write_text("<script>alert(1)</script>\nSecond line", encoding="utf-8")
    refs = load_references([path], "Test")
    assert refs[0]["lines"][1] == "Second line" and len(refs[0]["sha256"]) == 64
    result = analyze(FakeClient([HYP]), task="<script>alert(2)</script>", observation=OBS)
    result["references"] = refs
    output = render(result)
    assert "<script>alert" not in output and "&lt;script&gt;" in output
    assert "expert review required" in output
    path.write_text("")
    with pytest.raises(ValueError):
        load_references([path])


def test_cli_writes_cached_observations_json_and_notebook(tmp_path, monkeypatch):
    from unwritten import __main__ as cli
    obs = tmp_path / "clip.workflow.observations.json"
    obs.write_text(json.dumps(OBS))
    monkeypatch.setattr(cli, "_client", lambda: FakeClient([HYP]))
    monkeypatch.setattr("sys.argv", ["unwritten", "analyze", "--observations", str(obs),
                                    "--task", "Synthetic sample"])
    cli.main()
    output = json.loads((tmp_path / "clip.workflow.json").read_text())
    assert output["kind"] == "workflow_analysis"
    assert (tmp_path / "clip.workflow.html").is_file()


def test_cli_preserves_existing_review_before_any_model_call(tmp_path, monkeypatch):
    from unwritten import __main__ as cli
    obs = tmp_path / "clip.workflow.observations.json"
    obs.write_text(json.dumps(OBS))
    (tmp_path / "clip.workflow.json").write_text("previous review")
    monkeypatch.setattr(cli, "_client", lambda: pytest.fail("Should not call Meta"))
    monkeypatch.setattr("sys.argv", ["unwritten", "analyze", "--observations", str(obs),
                                    "--task", "Synthetic sample"])
    with pytest.raises(SystemExit):
        cli.main()
    assert (tmp_path / "clip.workflow.json").read_text() == "previous review"
