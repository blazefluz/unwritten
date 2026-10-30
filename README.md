# Unwritten

**Learn the rules nobody wrote down, by watching someone work.**

Experienced people follow rules they've never written down: where each parcel goes,
which returns get refurbished, what to do when the machine shows an amber light.
Unwritten watches a video of the work, writes down every decision it sees, works out
the rules behind those decisions, checks them against what actually happened, and
then predicts the next decisions in the video before they happen. Where the evidence
is thin, it asks the expert targeted questions.

Built for the **Meta Global AI Developer Hackathon** (Oct 27 – Nov 4, 2026),
**Push the Frontier** / **Build for Your World**, Indie Developer track.

## How it works

```
video ──► 1. OBSERVE      Muse Spark logs every decision: time, item, visible attributes, outcome
          2. HYPOTHESIZE  Muse Spark proposes the simplest ordered rule list
          3. CHECK        plain code applies the rules to every observation and scores them
          4. REVISE       counterexamples go back to Muse Spark until the rules hold or it
                          flags a specific observation as suspect (with a reason)
          5. PREDICT      rules learned from the first part of the video predict the rest
          6. COMPARE      against a no-AI baseline (best single-attribute lookup table)
          7. ASK          Muse Spark asks the expert about thresholds and combinations
                          the video never tested
──► lab notebook (HTML) + full JSON record
```

**Split of responsibilities:** the model does perception and hypothesis; code does
all scoring. Every accuracy number in the notebook is computed by deterministic code
(`unwritten/rules.py`), never reported by the model itself. The test is
chronological: rules learned from earlier events have to predict later ones.

## Meta models used

| Step | Model | Via |
|---|---|---|
| Watch video, log events | Muse Spark (`muse-spark-1.3`) | Meta Model API, Files + Responses API |
| Propose / revise rules | Muse Spark | Responses API, JSON-schema structured output |
| Ask targeted questions | Muse Spark | Responses API, JSON-schema structured output |

## Quick start

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m unwritten serve           # open http://127.0.0.1:8765
```

Open the **synthetic sample** to see the whole flow with no key and no video. It uses
hand-written data and scripted replies, and every page says so.

To run a real clip, add your Meta Model API key, confirm it works, and restart the app:

```bash
echo 'MODEL_API_KEY=your-key' > .env
python -m unwritten check
```

Upload an mp4 in the app. It logs the decisions, learns rules from the first 60%, then
plays the clip and shows each prediction **before** the person acts. Answer the expert
questions and the rules are revised and re-scored in code; the model sees only the
training events, so the held-out score stays a real test.

### Command line

```bash
python -m unwritten run clip.mp4 --domain sorting
# → labs/clip.observations.json, .lab.json, .lab.html, .live.html
```

Two-step mode (re-run the reasoning without re-watching the video):

```bash
python -m unwritten observe clip.mp4 --domain sorting --context "warehouse returns desk"
python -m unwritten learn labs/clip.observations.json --train 0.6 --rounds 3
```

Domains: `sorting` (where items go), `sequence` (what an operator does next),
`game` (what a move does).

### Measuring it against the truth

The lab's accuracy compares rules with the model's own log, so it cannot catch a
misperceived video. Label clips by hand ([format](evals/README.md)) and score the model
against your labels:

```bash
python -m unwritten eval evals/
```

### Using YouTube clips

Only Creative Commons clips. The helper checks the license and refuses anything else,
then saves an attribution file for the credits:

```bash
python -m unwritten fetch "https://www.youtube.com/watch?v=..." --start 30 --end 150
```

Find candidates with YouTube search → **Filters → Creative Commons**.

## Limits

- Prediction is only as good as perception. Use `eval` to measure how good that is.
- The model logs each item's attributes after watching the whole clip, including where
  the item went, so those descriptions may be influenced by the outcome. A chronological
  split cannot rule this out; hand-labelled attributes can.
- A short clip gives a small test set. Read 5/6 as a small sample, not as 83%.

## Tests

```bash
python -m pytest -q
```

The tests use a scripted stand-in for the model and a hand-written fixture
(`fixtures/synthetic_parcels.observations.json`, **synthetic test data, not from a
video**) to verify the checking, revision, prediction, baseline, evaluation and app
logic offline.

## Built during the hackathon

All code in this repository was written during the building period (Oct 27 – Nov 4,
2026); see the commit history.

## License

MIT
