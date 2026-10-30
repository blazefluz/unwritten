# Evaluation

Each clip needs a hand-labelled `<clip>.truth.json` here. Watch the clip yourself and
write the labels **before** reading the model's log, so its answers don't steer yours.

```json
{
  "outcome_aliases": {"left bin": "bin_a"},
  "attribute_aliases": {"colour": "color"},
  "events": [
    {"time_start": 3.0, "item": "red box",
     "attributes": {"color": "red", "damaged": "no"}, "outcome": "bin_a"}
  ]
}
```

- `events`: every decision in the clip. `attributes` holds only what you want scored.
- `outcome_aliases`, `attribute_aliases`: optional, map the model's labels onto yours.
  Write them for naming differences only. Anything without an alias must match exactly.

Run the clip first (`python -m unwritten run <clip>.mp4`), then:

```bash
python -m unwritten eval evals/
```

| Column | Meaning |
|---|---|
| events found | share of your decisions the model logged, matched within 3 s (`--tolerance`) |
| false events | decisions the model logged that you did not |
| outcomes | where matched decisions went, compared with your labels |
| attributes | the attributes you labelled, compared on matched decisions |
| held-out vs truth | the rules' predictions compared with **your** labels, the number to quote |

Results go to `evals/eval_report.json`.
