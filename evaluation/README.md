# Real-video evaluation

Real Meta development runs have now been completed. See the
[training-guide pilot audit](training-guide-pilot.md) for the measured cable
results and their limitations. Independent business validation is still pending.
Use the [partner collection pack](partner-pilot/README.md) for the next stage.
`annotations.csv` remains an empty annotation template, not ground truth or model output.

## Select footage

An earlier warehouse candidate was: **Warehouse Entry Bag
Check weighing and Manual Sorting system**, by **Dhanvanthri Engineers**:
<https://www.youtube.com/watch?v=ioqxuv8ItgA>. Downloaded with the license-checking
helper to `clips/warehouse-bags/ioqxuv8ItgA.mp4`; its `.attribution.json` records
the Creative Commons Attribution license and credit line. It shows sacks being
fed through a weighing line and workers handling bags beside the conveyors.
This is inbound bag handling, not a returns desk. Sampled frames show camera cuts
and a later view of the weighing dashboard. Do not assume the policy from sack
appearance: weights or software instructions may drive routing. Review continuous
segments before annotating and mark unavailable decision inputs as unknown.

The product now supports any observed task. Warehouse handling, repair and cable
comparison are development examples; none substitutes for independent operator
validation of the training-guide proposition.

Use a continuous shot of a person sorting items. Both the item before pickup and
its destination must be visible. Aim for at least 20 decisions, three destinations,
and examples of every destination in the first 60% of the sequence. Record cuts,
occlusions and ambiguous decisions. Do not silently remove difficult events.

The downloaded recycling clip (`clips/v7BuUzstgkw.mp4`, original 7:58–8:40)
contains cuts and only a short manual-sorting section. It is a perception smoke
test candidate, not an established benchmark. `Sorting by Colors` by Teach for
Life (`nDlrtW0GmAU`) is an animated explainer and is unsuitable for the real-work
demo. Both downloads have Creative Commons attribution records beside them.

## Label before running Meta

Copy `annotations.csv` for each accepted clip. A human reviewer should watch it
without seeing model output and enter one row per sorting decision:

- `event_id`: stable ID assigned in chronological order.
- `time_start`: pickup time in seconds relative to the downloaded clip, not YouTube.
- `time_end`: placement/release time in seconds relative to the downloaded clip.
- `item`: a short visible description, not a guess about its purpose.
- `attributes_json`: JSON object of properties visible before the outcome, e.g.
  `{"colour":"red","condition":"damaged"}`. Use `unknown` where necessary.
- `outcome`: a consistent destination label such as `left_bin`.
- `visibility`: `clear`, `occluded` or `ambiguous`.
- `notes`: the evidence, uncertainty or cut affecting the event.

Do not infer a label from a supposed rule. Keep ambiguous outcomes unknown.
Record reviewer name, date, source URL, license and any trims with the completed
annotation file. Freeze a copy before inspecting model observations. The example
attribute values above are illustrative, not observations from any clip.

## First real run

Run from the repository root after Meta credits are visible and a payment method
is configured. Set `MODEL_API_KEY` privately in the terminal; never commit it.

```sh
.venv/bin/python -m pytest -q
.venv/bin/python -m unwritten observe clips/your-clip.mp4 --domain sorting \
  --context "One continuous sorting session. Describe visible attributes before pickup; use consistent spatial destination labels. Mark uncertainty instead of guessing."
.venv/bin/python -m unwritten learn clips/your-clip.observations.json --train 0.6 --rounds 3
```

The existing pipeline observes the whole video before splitting events. Its
reported held-out score compares rules against model-observed outcomes, not human
ground truth. Full-video perception can also use later context. Describe this as
offline chronological rule evaluation, not a proven live forecasting result.

## Independent checks

Manually align observed events to annotated events by item and time, one to one.
Count missing events, extra events, and incorrect attributes or outcomes. State the
alignment tolerance before scoring (start with two seconds, then disclose it).
Report counts and denominators, not just percentages:

1. Event recall: matched real events / all annotated real events.
2. Event precision: matched real events / all model-observed events.
3. Outcome accuracy: correct destinations / matched events with clear destinations.
4. Attribute accuracy: correct values / reviewed, visible attribute values.
5. Timing error: absolute pickup and placement errors for matched events.
6. Held-out rule accuracy against human outcomes, separately from the notebook's
   model-observation agreement. Disclose missed held-out events as well.

Fit the OneR comparison on training events only. Apply both methods to the same
held-out items and report how many were eligible. Never use held-out errors to
revise rules and then present the same items as an untouched test. Use another
clip for evaluation after expert answers change rules.

## Self-filmed fallback

Film a two-minute tabletop returns simulation if a suitable licensed clip cannot
be obtained. Use 24 distinguishable objects or mock parcels, three labelled bins,
a fixed camera, good lighting, and no edits. Keep hands from hiding destinations.
Use an ordered policy with an exception: damaged items first, then a visible
category, then a default destination. Shuffle item order and include every case
in both chronological portions. Keep the policy private during observation.

Label this honestly as a **staged returns simulation**, not a real warehouse trial
or naturally discovered expert practice. Do not claim it establishes performance
in a working warehouse. A colour-only clip is useful for perception debugging but
cannot demonstrate an advantage over the single-attribute baseline.
