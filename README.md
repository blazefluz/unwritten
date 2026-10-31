# Unwritten

**Learn the rules nobody wrote down, by watching someone work.**

Experienced people follow rules they've never written down: where each parcel goes,
which returns get refurbished, what to do when the machine shows an amber light.
Unwritten watches a video of the work, writes down every decision it sees, works out
the rules behind those decisions, checks them against what actually happened, and
then predicts the next decisions in the video before they happen. Where the evidence
is thin, it asks the expert targeted questions.

Built for the **Meta Global AI Developer Hackathon** (Oct 26 – Nov 4, 2026),
**Build for Your World** problem statement, Indie Developer track. The domain is one we
know: a warehouse returns desk, where the choice of where each parcel goes rests on habits
that were never written down.

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
pip install -r requirements.txt
export MODEL_API_KEY=...            # Meta Model API key

python -m unwritten run clip.mp4 --domain sorting
# → clip.observations.json, clip.lab.json, clip.lab.html, clip.player.html
```

`clip.player.html` is the **prediction player**: it plays the clip and, for every
held-out event, shows the rules' prediction when the item is picked up, then reveals
where it actually went when it is placed, with a running score. Keep it next to the
clip, or rebuild it from a lab record at any time:

```bash
python -m unwritten play clip.lab.json --video clip.mp4
```

Two-step mode (re-run the reasoning without re-watching the video):

```bash
python -m unwritten observe clip.mp4 --domain sorting --context "warehouse returns desk"
python -m unwritten learn clip.observations.json --train 0.6 --rounds 3
```

Domains: `sorting` (where items go), `sequence` (what an operator does next),
`game` (what a move does).

### Using YouTube clips

Only Creative Commons clips. The helper checks the license and refuses anything else,
then saves an attribution file for the credits:

```bash
python -m unwritten fetch "https://www.youtube.com/watch?v=..." --start 30 --end 150
```

Find candidates with YouTube search → **Filters → Creative Commons**.

## Tests

```bash
python -m pytest -q
```

The tests use a scripted stand-in for the model and a hand-written fixture
(`fixtures/synthetic_parcels.observations.json`, **synthetic test data, not from a
video**) to verify the checking, revision, prediction and baseline logic offline.

## Built during the hackathon

All code in this repository was written during the building period (Oct 26 – Nov 4,
2026); see the commit history. Everything in `unwritten/` and `tests/` is new work:
the observe/hypothesize/check/revise loop, the deterministic rule checker and OneR
baseline, the lab notebook, the prediction player, and the Creative Commons clip helper.

Third-party pieces we did not write:

| Component | Used for |
|---|---|
| Muse Spark via Meta Model API | all perception and rule hypotheses |
| [`openai`](https://github.com/openai/openai-python) Python SDK | only as the client for Meta's OpenAI-compatible endpoint; no OpenAI models are used |
| [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) | downloading Creative Commons clips (`fetch`) |
| [`pytest`](https://pytest.org) | tests |

Any third-party video clip is credited from the attribution file `fetch` writes.

## License

MIT
