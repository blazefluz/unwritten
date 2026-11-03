# Test a complete decision sequence

The workflow analyzer records actions and proposes interpretations. The separate
`test-decisions` command measures whether a rule learned from the beginning of a
sequence predicts later actions. It works for any task with observable decisions.

1. Watch the entire rights-cleared clip and check the saved workflow observations.
   Fix missing or incorrect actions and timestamps before evaluating. Do not label
   a repair successful unless the clip demonstrates that outcome.
2. Define a small, consistent action vocabulary (for example, `inspect`, `adjust`,
   `test`, `stop`). Human-label every event. Save a JSON object mapping event IDs
   to these categories. These names are examples, not annotations of our mower clip.
3. Run:

```sh
.venv/bin/python -m unwritten test-decisions path/to/clip.workflow.observations.json \
  --labels path/to/human-labels.json --train 0.6 --out path/to/decision-test.json
```

This command uses the separately billed Meta Model API via `MODEL_API_KEY`.
A Muse Code subscription does not fund it. Model calls go through `MetaClient`.
Cost is one rule-inference call plus one prediction call per held-out event.

The first 60% of chronological events supply the rules. Rules then remain frozen.
For each later event, the model receives only earlier events and labels, plus the
task's category vocabulary. It receives no target action, target evidence, future
events, references, full video or expert answers. After a prediction is recorded,
that event can become context for the following prediction. Overlapping event
intervals are rejected because they can leak the target action.

Code compares category strings exactly. Abstentions count as incorrect in the
overall score and are also counted separately. A fixed majority-category baseline
is learned from the training prefix. Keep all predictions, misses and uncertainty
in the report; do not present the score as diagnostic or manufacturer accuracy.

Use `analyze` separately for reference review. Supply the equipment identity and
applicable manual excerpt. Exact citation validation establishes text provenance,
not the truth of a model's interpretation. The John Deere TM1471 preview we found
establishes model coverage only; it is insufficient to verify a repair procedure.

The downloaded mower clip currently has a six-frame subscription feasibility
test. It has **not** received human event labels or a full decision evaluation.
The Next.js **Decision test** workspace supports local video playback, event
correction, human labels, draft recovery and evaluation imports. It can run the
same evaluator when a Meta API key is available. CLI exports and UI exports share
the same format. Each evaluation includes an input fingerprint so corrected
event/label versions can be distinguished. Browser storage is local, not a backup;
export drafts before clearing browser data.
