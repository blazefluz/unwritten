# Unwritten

**Learn the rules nobody wrote down, by watching someone work.**

Unwritten now includes a general workflow review: describe any task, supply a
video and optional reference excerpts, and inspect the observed actions,
hypothesized decision principles, cited reference checks, revisions and questions
for the expert. Repair, inspection, sorting and other tasks use the same engine.
The warehouse example remains available through the original rule-learning CLI.

## Review any task

### Next.js workspace

```bash
npm ci --prefix web
npm run dev
# Open http://127.0.0.1:3040
```

The local workspace includes source-video playback, an event timeline, linked
reasoning and citations, reference documents, revision history, and expert-answer
export. Open an existing `.workflow.json` with **Open review**, or choose
**New analysis** to send a video and optional excerpts to the Python engine.
The initial example is explicitly synthetic, not a real analysis. Attaching a
local video to an existing review only changes playback; attach its matching
source to use the recorded timestamps. Imported reviews and draft expert answers
are saved in this browser across refreshes. Export backups; browser storage can
be cleared or run out of space. Videos must be reattached after refreshing.

**Decision test** works offline for event correction and human action labels.
Import saved observations, or add events manually while watching a local video.
Save an annotation draft, export corrected observations and labels, then run a
chronological test when Meta API access is ready. Its rules are learned from the
training prefix and frozen; predictions are scored by code against human labels,
including misses, abstentions and a majority-category baseline. Open an evaluation
JSON to inspect every prediction. Imported reports have their score arithmetic
checked, but their execution and labels are not independently verified.
`examples/synthetic-decisions.annotations.json` is a scripted interface fixture,
not real video observations. See [the evaluation guide](evaluation/decision-test.md).

Expert questions now offer **Re-review with Meta**. Answers remain attributed
testimony, and a new review retains all previous rounds. The original observations
are reused; the video is not uploaded again.

For new Meta analyses, install the Python dependencies into `.venv`, add
`MODEL_API_KEY` to the gitignored `web/.env.local`, and restart Next.js. Keys stay
on the server; never use a `NEXT_PUBLIC_` variable for credentials. The default
Python executable is `.venv/bin/python`; override it with `UNWRITTEN_PYTHON` if
needed. Wait for billing/API access and credits before starting a paid run.
Optional timestamped `.txt`/`.md` transcripts can accompany a video. Times must
be relative to the selected clip; exclude narration from outside it. Label automatic
captions and keep speaker testimony separate from visible evidence. The CLI accepts
`--transcript path/to/captions.txt`. Transcripts are not manufacturer references.

The upload form accepts local MP4 videos up to 100 MB and UTF-8 `.txt`/`.md`
references. Its same-origin route invokes `unwritten.web_bridge`; saved run inputs,
observations, and results remain locally in the ignored `.unwritten-runs/` folder.
The app is designed for a local Node.js server with Python, not a serverless host.

Production checks: `npm run build` and `npm run typecheck`.

### Python CLI

```bash
python -m unwritten analyze task.mp4 \
  --task "Describe the work, equipment/model and situation" \
  --reference reference-excerpt.txt \
  --reference-scope "Document title, issuer, model/version and applicability"
```

References are optional, repeatable UTF-8 `.txt` or `.md` excerpts. Export relevant
PDF passages to text first and include the original page numbers, document title,
edition and source URL in the text. Use sources you have rights to use. This
version does not fetch manuals or establish their authenticity automatically.
Use the exact equipment/version when available; unspecified or uncertain
applicability must remain inconclusive. Each reference is hashed and included
with numbered lines in the notebook so its citations can be checked.

Outputs: `task.workflow.observations.json`, `task.workflow.json` and
`task.workflow.html`. The stages are:

1. **Observe:** Meta logs timestamped actions, visible evidence, observed results
   and uncertainty, before seeing reference documents.
2. **Hypothesize:** Meta proposes principles linked to those event IDs, with
   alternative explanations and targeted expert questions.
3. **Check:** Meta assesses the supplied references. Code checks every citation's
   reference ID, line range and exact full-line quotation. Unsupported citations
   are downgraded to inconclusive. No model-reported accuracy is used.
4. **Revise:** Conflicts and invalid citations trigger another hypothesis/review
   round (default two, maximum three). Earlier attempts remain in the record.
5. **Ask:** Answer the questions and re-run reasoning without watching again:

```bash
python -m unwritten analyze --observations task.workflow.observations.json \
  --task "Describe the same task and situation" \
  --reference reference-excerpt.txt --reference-scope "Exact scope" \
  --answers expert-answers.json --out reviews/after-expert
```

The answers file maps **full question text** to answer text. Answers are retained
as expert testimony, not independent verification. Existing review outputs are
not overwritten; use a new `--out` prefix for each follow-up.

**Limits:** an exact citation proves text provenance, not that the model has
interpreted it correctly. “Supported” and “conflicts” are model assessments that
require expert review, not compliance certifications or validated diagnoses.
Missing video evidence does not prove a step was skipped. This workflow is an
offline retrospective review, not a live forecasting system. Generic task support
does not establish performance on every domain. The first real Meta video run is
still pending; the test suite uses explicitly synthetic examples.

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
The general task workflow, reference citation checker, revision notebook and
expert-answer reanalysis were also built during the event. A clearly labelled
offline sample is in `examples/synthetic-workflow.html`.
The Next.js workspace, offline annotation editor, chronological action evaluation,
expert-answer review controls and local Python bridge are new work too.

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
