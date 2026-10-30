"""Offline tests for scoring the model against hand-labelled ground truth."""
import json

from unwritten.evals import align, evaluate, evaluate_folder, format_report
from unwritten.rules import Event


def ev(i, t, outcome="a", **attrs):
    return {"index": i, "time_start": t, "item": "x", "attributes": attrs, "outcome": outcome}


def events(*times):
    return [Event.from_dict(ev(i, t)) for i, t in enumerate(times)]


def test_align_prefers_more_matches_then_closest_time():
    assert align(events(1, 10), events(1.5, 9), 3) == [(0, 0), (1, 1)]
    assert align(events(5.0), events(4.0, 5.5), 3) == [(0, 1)]


def test_unordered_truth_file_is_sorted_before_matching():
    obs = {"events": [ev(0, 1, "a"), ev(1, 20, "b")]}
    truth = {"events": [ev(0, 20, "b"), ev(1, 1, "a")]}
    r = evaluate(obs, truth)
    assert r["matched_events"] == 2 and r["outcome_accuracy"] == 1.0


def test_missed_and_invented_events_are_counted():
    obs = {"events": [ev(0, 1), ev(1, 50)]}
    truth = {"events": [ev(0, 1), ev(1, 20)]}
    r = evaluate(obs, truth)
    assert (r["matched_events"], r["event_precision"], r["event_recall"]) == (1, 0.5, 0.5)


def test_outcome_and_attribute_accuracy_use_explicit_aliases_only():
    obs = {"events": [ev(0, 1, "left bin", colour="red", kg="5.0"),
                      ev(1, 5, "right bin", colour="unknown", kg="2")]}
    truth = {"outcome_aliases": {"left bin": "bin_a"}, "attribute_aliases": {"colour": "color"},
             "events": [ev(0, 1, "bin_a", color="red", kg="5"), ev(1, 5, "bin_b", color="blue", kg="2")]}
    r = evaluate(obs, truth)
    assert r["outcome_accuracy"] == 0.5  # "right bin" has no alias, so it stays wrong
    assert r["per_attribute_accuracy"] == {"color": 0.5, "kg": 1.0}


def test_heldout_predictions_are_rescored_against_truth():
    obs = {"events": [ev(0, 1, "b"), ev(1, 5, "b")]}
    truth = {"events": [ev(0, 1, "a"), ev(1, 5, "b")]}
    lab = {"predictions": [{"index": 0, "predicted": "b"}, {"index": 1, "predicted": "b"}]}
    r = evaluate(obs, truth, lab)
    assert (r["heldout_scored"], r["heldout_hits"], r["heldout_accuracy_vs_truth"]) == (2, 1, 0.5)


def test_folder_report_pools_events_not_clip_averages(tmp_path):
    (tmp_path / "a.truth.json").write_text(json.dumps({"events": [ev(0, 1)]}))
    (tmp_path / "a.observations.json").write_text(json.dumps({"events": [ev(0, 1)]}))
    (tmp_path / "b.truth.json").write_text(json.dumps({"events": [ev(i, i * 10) for i in range(3)]}))
    (tmp_path / "b.observations.json").write_text(json.dumps({"events": [ev(0, 0, "z")]}))
    (tmp_path / "c.truth.json").write_text(json.dumps({"events": [ev(0, 1)]}))
    report = evaluate_folder(tmp_path, labs=tmp_path / "none")
    assert report["pooled"]["clips"] == 2
    assert report["pooled"]["event_recall"] == 0.5  # 2 of 4, not the mean of 100% and 33%
    assert "no observations file" in format_report(report)
