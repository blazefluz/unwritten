"""Small, auditable numeric preference pilot; scores are computed in code."""
from __future__ import annotations

import math
from itertools import combinations
from .workflow import BOUNDARY, S, obj

COMPARATOR_SCHEMA = obj({
    "transform": {"type": "string", "enum": ["identity", "absolute", "abstain"]},
    "direction": {"type": "string", "enum": ["higher", "lower"]},
    "reason": S, "limitations": S,
})


def winner(left, right, rule):
    a, b = left.get("voltage_v"), right.get("voltage_v")
    if (rule["transform"] == "abstain" or
            any(type(v) not in (int, float) or not math.isfinite(v) for v in (a, b))):
        return None
    if rule["transform"] not in {"identity", "absolute"} or rule["direction"] not in {"higher", "lower"}:
        raise ValueError("Invalid comparator.")
    if rule["transform"] == "absolute":
        a, b = abs(a), abs(b)
    if a == b:
        return None
    return left["id"] if (a > b) == (rule["direction"] == "higher") else right["id"]


def evaluate(client, measurements, reference_order, *, training_ids):
    ids = [m["id"] for m in measurements]
    if (len(ids) != len(set(ids)) or len(reference_order) != len(set(reference_order))
            or set(ids) != set(reference_order) or len(training_ids) != len(set(training_ids))
            or not 2 <= len(training_ids) < len(ids) or not set(training_ids) <= set(ids)):
        raise ValueError("Require unique measurements, a complete reference ordering, and a training subset.")
    by_id = {m["id"]: m for m in measurements}
    ranks = {item: i for i, item in enumerate(reference_order)}
    training = [{"id": item, "voltage_v": by_id[item].get("voltage_v")} for item in training_ids]
    preferences = [{"left": a, "right": b, "preferred": min((a,b), key=ranks.get)}
                   for a,b in combinations(training_ids, 2)]
    rule = client.ask_json(
        BOUNDARY + "Infer a minimal numeric comparison rule from the training examples and "
        "pairwise preferences. Choose identity or absolute value and higher or lower. "
        "Abstain if evidence is insufficient. Explain what is inferred versus prior knowledge. "
        "Do not claim compliance, an acceptance threshold, or repair success. "
        "Only this numeric feature is available; acknowledge this constrained hypothesis space.\n"
        + __import__('json').dumps({"measurements": training, "preferences": preferences}),
        COMPARATOR_SCHEMA, "ranking_comparator")
    if rule.get("transform") not in {"identity", "absolute", "abstain"} or rule.get("direction") not in {"higher", "lower"}:
        raise ValueError("Model returned an invalid comparator.")
    held_out = [item for item in ids if item not in training_ids]
    rows = []
    baseline = {"transform": "absolute", "direction": "higher"}
    # Fixed denominator: every held-out item versus every training item. No
    # observed target preferences are fed back, and missing readings abstain.
    for target in held_out:
        for anchor in training_ids:
            expected = min((target,anchor), key=ranks.get)
            predicted = winner(by_id[target], by_id[anchor], rule)
            simple = winner(by_id[target], by_id[anchor], baseline)
            rows.append({"left": target, "right": anchor, "predicted": predicted,
                         "expected": expected, "correct": predicted == expected,
                         "baseline": simple, "baseline_correct": simple == expected})
    return {"kind": "numeric_ranking_evaluation", "training_ids": training_ids,
            "held_out_ids": held_out, "training_preferences": preferences,
            "frozen_rule": rule, "comparisons": rows,
            "score": {"correct": sum(r["correct"] for r in rows), "total": len(rows),
                      "abstained": sum(r["predicted"] is None for r in rows),
                      "baseline_correct": sum(r["baseline_correct"] for r in rows)},
            "limitations": "One creator, one clip, one numeric feature. The comparator family "
            "was supplied by the developer. Reference labels were transcribed by the coding "
            "assistant from the creator's written results, not independently human-verified. "
            "This is preference agreement, not electrical compliance or proof of novel learning. "
            "Model prior knowledge may explain the inferred rule."}
