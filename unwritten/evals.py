"""Score the model against hand-labelled ground truth.

The lab's own accuracy compares rules with the model's observations, so it cannot
reveal a misperceived video. This module compares both with a person's labels.

A truth file sits next to its clip as <clip>.truth.json:

    {"outcome_aliases": {"left bin": "bin_a"},
     "attribute_aliases": {"colour": "color"},
     "events": [{"time_start": 3.0, "item": "red box",
                 "attributes": {"color": "red"}, "outcome": "bin_a"}]}

Aliases map the model's labels onto yours and are written by hand, never inferred,
so a wrong label cannot be mapped into a right one after the fact.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .rules import Event, _num, norm


def align(observed: list[Event], truth: list[Event], tolerance: float
          ) -> list[tuple[int, int]]:
    """Match events in time order: most matches first, then smallest timing error."""
    n, m = len(observed), len(truth)
    best = [[(0, 0.0)] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            options = [best[i + 1][j], best[i][j + 1]]
            gap = abs(observed[i].time_start - truth[j].time_start)
            if gap <= tolerance:
                count, cost = best[i + 1][j + 1]
                options.append((count + 1, cost - gap))
            best[i][j] = max(options)
    pairs, i, j = [], 0, 0
    while i < n and j < m:
        if best[i][j] == best[i + 1][j]:
            i += 1
        elif best[i][j] == best[i][j + 1]:
            j += 1
        else:
            pairs.append((i, j))
            i, j = i + 1, j + 1
    return pairs


def _same(a: str, b: str) -> bool:
    x, y = _num(a), _num(b)
    return x == y if x is not None and y is not None else a == b


def _ratio(hits: int, total: int) -> float | None:
    return hits / total if total else None


def evaluate(observation: dict[str, Any], truth: dict[str, Any],
             lab: dict[str, Any] | None = None, tolerance: float = 3.0) -> dict[str, Any]:
    outcome_aliases = {norm(k): norm(v) for k, v in truth.get("outcome_aliases", {}).items()}
    attr_aliases = {norm(k): norm(v) for k, v in truth.get("attribute_aliases", {}).items()}
    seen = sorted((Event.from_dict(e) for e in observation["events"]), key=lambda e: e.time_start)
    real = sorted((Event.from_dict({"index": i, **e}) for i, e in enumerate(truth["events"])),
                  key=lambda e: e.time_start)
    pairs = align(seen, real, tolerance)

    outcome_hits = attr_hits = attr_total = 0
    timing = 0.0
    per_attribute: dict[str, list[int]] = {}
    for i, j in pairs:
        o, t = seen[i], real[j]
        timing += abs(o.time_start - t.time_start)
        outcome_hits += outcome_aliases.get(o.outcome, o.outcome) == t.outcome
        renamed = {attr_aliases.get(k, k): v for k, v in o.attributes.items()}
        for name, value in t.attributes.items():
            hit = _same(renamed.get(name, ""), value)
            tally = per_attribute.setdefault(name, [0, 0])
            tally[0] += hit
            tally[1] += 1
            attr_hits += hit
            attr_total += 1

    report = {
        "observed_events": len(seen), "truth_events": len(real), "matched_events": len(pairs),
        "outcome_hits": outcome_hits, "attribute_hits": attr_hits, "attribute_total": attr_total,
        "event_precision": _ratio(len(pairs), len(seen)),
        "event_recall": _ratio(len(pairs), len(real)),
        "outcome_accuracy": _ratio(outcome_hits, len(pairs)),
        "attribute_accuracy": _ratio(attr_hits, attr_total),
        "per_attribute_accuracy": {k: v[0] / v[1] for k, v in sorted(per_attribute.items())},
        "mean_timing_error_s": timing / len(pairs) if pairs else None,
    }
    if lab:
        truth_for = {seen[i].index: real[j] for i, j in pairs}
        scored = [p for p in lab["predictions"] if p["index"] in truth_for]
        hits = sum(outcome_aliases.get(norm(p["predicted"]), norm(p["predicted"]))
                   == truth_for[p["index"]].outcome for p in scored)
        report.update(heldout_predictions=len(lab["predictions"]), heldout_scored=len(scored),
                      heldout_hits=hits, heldout_accuracy_vs_truth=_ratio(hits, len(scored)))
    return report


def _find(stem: str, suffix: str, folders: list[Path]) -> Path | None:
    return next((f / f"{stem}{suffix}" for f in folders if (f / f"{stem}{suffix}").is_file()), None)


def evaluate_folder(folder: str | Path, labs: str | Path = "labs",
                    tolerance: float = 3.0) -> dict[str, Any]:
    """Evaluate each <clip>.truth.json in folder, plus totals pooled across clips."""
    folder = Path(folder)
    search = [folder, Path(labs)]
    clips: dict[str, Any] = {}
    for path in sorted(folder.glob("*.truth.json")):
        stem = path.name.removesuffix(".truth.json")
        obs_path = _find(stem, ".observations.json", search)
        if not obs_path:
            clips[stem] = {"error": "no observations file; run the clip first"}
            continue
        lab_path = _find(stem, ".lab.json", search)
        clips[stem] = evaluate(json.loads(obs_path.read_text()), json.loads(path.read_text()),
                               json.loads(lab_path.read_text()) if lab_path else None, tolerance)
    scored = [c for c in clips.values() if "error" not in c]

    def total(key: str) -> int:
        return sum(c.get(key, 0) for c in scored)

    return {
        "clips": clips,
        "pooled": {
            "clips": len(scored),
            "event_precision": _ratio(total("matched_events"), total("observed_events")),
            "event_recall": _ratio(total("matched_events"), total("truth_events")),
            "outcome_accuracy": _ratio(total("outcome_hits"), total("matched_events")),
            "attribute_accuracy": _ratio(total("attribute_hits"), total("attribute_total")),
            "heldout_accuracy_vs_truth": _ratio(total("heldout_hits"), total("heldout_scored")),
        },
    }


def format_report(report: dict[str, Any]) -> str:
    def pct(value: float | None) -> str:
        return "n/a" if value is None else f"{value:.0%}"

    rows = ["clip | events found | false events | outcomes | attributes | held-out vs truth",
            "---|---|---|---|---|---"]
    for name, c in report["clips"].items():
        if "error" in c:
            rows.append(f"{name} | {c['error']} | | | |")
            continue
        rows.append(f"{name} | {pct(c['event_recall'])} | "
                    f"{c['observed_events'] - c['matched_events']} | {pct(c['outcome_accuracy'])} | "
                    f"{pct(c['attribute_accuracy'])} | {pct(c.get('heldout_accuracy_vs_truth'))}")
    p = report["pooled"]
    rows.append(f"**pooled ({p['clips']} clips)** | {pct(p['event_recall'])} | "
                f"precision {pct(p['event_precision'])} | {pct(p['outcome_accuracy'])} | "
                f"{pct(p['attribute_accuracy'])} | {pct(p['heldout_accuracy_vs_truth'])}")
    return "\n".join(rows)
