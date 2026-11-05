# World Studio

**Build a shop with Muse. Check the layout. Test it with simulated shoppers.**

Built by **Victor Akpomudje** ([blazefluz](https://github.com/blazefluz)) for the Meta Global AI Developer Hackathon, Indie Developer track, Build for Your World.

World Studio is a shared 3D workspace with an embodied AI collaborator. Start with a shop photograph, let Meta Muse Spark propose fixtures and merchandise, then inspect and edit the resulting space. Code checks placement and simulates shoppers so you can explore a layout before changing a real store.

[Public studio](https://unwritten-demo.onrender.com/studio) · [Car concept workbench](https://unwritten-demo.onrender.com/studio/car)

**Hosted demo limits:** the latest UI is deployed, but live Muse editing and photo reconstruction are restricted by the public access guard. Run locally with a Meta API key for the full AI flow. Free hosting can take around a minute to wake up. Browser scenes are device-local; export backups.

## Try it locally

Requires Node.js 22+, Python 3.10+ and a browser with WebGL.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm ci --prefix web
```

Create the gitignored `web/.env.local`:

```dotenv
MODEL_API_KEY=your_meta_model_api_key
```

```bash
npm run dev
```

Open **http://127.0.0.1:3040/studio** and select **Meta · Muse Spark**. The server uses `.venv/bin/python`; set `UNWRITTEN_PYTHON` to override it. Keep keys server-side; never prefix them with `NEXT_PUBLIC_`. Local commands and direct editing work without AI access.

## Photo → build → check → test

1. Choose **Build from a photo** and upload a shop image you have rights to use.
2. Inspect Muse's observations, uncertainty, custom fixtures and estimated product catalog.
3. Review any placement conflicts. **Find space** attempts deterministic placement repair; unresolved proposals stay in preview.
4. Select **Open shop** to run simulated shoppers through the store.
5. Use **Ask Muse to improve** to send the results back, then compare using the same shopper seed.
6. **Export scene** saves the layout, fixture definitions and catalog as JSON for reopening.

Muse can define new fixture geometry rather than only select catalog objects. The scene engine independently validates structured proposals and checks floor footprints. Shopper navigation, purchases, checkout, stock and revenue are computed in code. Prices and inventory inferred from a photo are estimates; simulated purchases are not forecasts of real sales. No visits to a fixture does not by itself establish that it is unreachable.

## What we tested

- A blocked-entrance test went from **0/12 to 11/12 simulated purchases** after Muse moved one object, with no give-ups or geometry conflicts, using the same seed.
- A supplied supermarket photo produced a **13-object mini-mart**. Code detected two overlaps; placement repair resolved them. A browser shop run completed with **12/12 purchases**, 26 items sold and no checkout failures. These are development tests of programmed behavior, not customer validation.
- A non-shop app screenshot was recognized as such; Muse returned no construction actions.

The experimental **car scene** supports editable body dimensions, an electric drivetrain, custom components, independent design bays, analytical packaging checks and up to three Muse design/check/revision attempts. A live test recorded a failed 2.15 m battery pack in a 2.00 m envelope, then increased wheelbase from 2.65 m to 2.80 m while preserving EV assumptions. The listed analytical checks passed. This is a concept workbench, not manufacturing-ready CAD or validated vehicle performance. Exact enclosure-clearance validation remains unfinished.

## Architecture and verification

- **Next.js + React:** editor, imports/exports and server routes.
- **Three.js:** procedural world, custom geometry, avatar and camera controls.
- **Meta Muse Spark (`muse-spark-1.3`):** image interpretation and structured design proposals through Meta Model API.
- **Python MetaClient:** model calls through the Responses API with JSON-schema output. The `openai` SDK is only a client for `https://api.meta.ai/v1`; the product uses Meta models.
- **TypeScript:** scene validation, placement repair, shopper simulation and EV calculations.

```bash
npm run test:studio --prefix web
.venv/bin/python -m pytest -q
npm run build
npm run typecheck
```

Tests are offline unless explicitly named as opt-in live tests. Model response times vary; failed requests preserve the saved scene. Photo reconstruction is approximate and may require placement repair.

## Earlier Unwritten workflows

This repository began with video-based expert-rule learning. Those CLI and review tools remain available; their documentation follows. The submitted World Studio experience is at `/studio`.


**Learn the rules nobody wrote down, by watching someone work.**

Unwritten now includes a general workflow review: describe any task, supply a
video and optional reference excerpts, and inspect the observed actions,
hypothesized decision principles, cited reference checks, revisions and questions
for the expert. Repair, inspection, sorting and other tasks use the same engine.
The warehouse example remains available through the original rule-learning CLI.

## Review any task

### Expert-reviewed training guides

The primary **Training guide** workspace turns inspection/triage examples into a
reviewable decision guide. Reviewers define observable features and attributed
outcomes, reserving separate cases for questions and validation. Meta proposes
competing decision lists; Python checks them and selects cases where consistent
rules disagree. When candidates all agree, a separately labelled spot-check can
probe unfamiliar feature values. An attributed answer can reject every explanation;
a bounded Meta revision then uses that answer while retaining the original rules
and direct baseline. Validation outcomes stay excluded.

Choose a consistent rule, record a demonstration review or expert self-attestation,
and freeze predictions before entering validation outcomes. Local server snapshots
and the first scored labels are retained in `.unwritten-runs/training/`. Code
reports agreement and coverage, abstentions, a direct Meta baseline without question
answers, the training-majority baseline and an optional declared task baseline.
Unknown evidence abstains. Review is not identity verification or compliance
certification. Feature annotation is currently assisted by a reviewer, not fully
automatic video-to-policy extraction.

**Load cable pilot** uses published measurements and transcribed preferences;
**Load synthetic exercise** uses explicitly scripted rules and outcomes. Neither
is a customer deployment. Proposal costs two Meta requests; saved-rule checks,
question selection, freezing, scoring and exports need no model calls. Only the
proposal step requires `MODEL_API_KEY`. Local server/Python access is still needed
for deterministic checks and frozen snapshots.

The [recorded development pilot](evaluation/training-guide-pilot.md) preserves both
the initial shared-assumption failure and the revised result; it is not customer
validation or proof of superiority to a strong baseline.

Read [the business validation protocol](evaluation/business-pilot-protocol.md) before
claiming training-time savings or decision quality. Guide sessions persist locally
and export as JSON; reviewed guides export as Markdown. Imported provenance is
self-reported and results should be rerun against the original local snapshot.

### Next.js workspace

The public World Studio demo and its access limits are described above. Earlier video-review access is documented in [reviewer access](docs/reviewer-access.md) and [deployment details](docs/deployment.md).

```bash
npm ci --prefix web
npm run dev
# Open http://127.0.0.1:3040
```

The local workspace includes source-video playback, an event timeline, linked
reasoning and citations, reference documents, revision history, and expert-answer
export. Open an existing `.workflow.json` with **Open review**, or choose
**New analysis** to send a video and optional excerpts to the Python engine.
The initial zipper-repair example is actual Meta output with an attributed CC BY
source video; its tentative rule remains unverified. Synthetic exercises remain
explicitly labelled. Attaching a local video to an existing review only changes playback; attach its matching
source to use the recorded timestamps. Imported reviews and draft expert answers
are saved in this browser across refreshes. Export backups; browser storage can
be cleared or run out of space. User-attached videos must be reattached after refreshing; the bundled repair demo
remains playable.

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

## World Studio experiment

A new branch experiment: enter a 3D room with an animated AI collaborator, create and edit catalog objects through Meta, and check placement in code. Run the existing web app and open **http://127.0.0.1:3040/studio**. Local editing works without a key; AI editing uses the server's Meta API credentials. Switch to **Car design** at **http://127.0.0.1:3040/studio/car** to create a concept car and edit its dimensions, paint and proportions with Meta or local controls. The market and car designs save separately. The car workbench can author new geometry with Meta, display an electric drivetrain, compute explicit-assumption analytical estimates, and expand into independent design bays. See [setup, demo and limits](docs/world-studio.md). These are visual editors, not physics or engineering simulators.

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
expert-answer review controls and local Python bridge are new work too. The
training-guide case editor, competing-rule checks, disagreement and coverage
questions, bounded revisions, reviewer attestation, frozen validation and guide
exports were also built during the event.

World Studio’s procedural 3D scene, avatar, object editor, placement validation,
preview/recovery flow and Meta scene-editing integration were also built during
the event. The maker’s market example and local parser are explicitly scripted.

Photo-to-store reconstruction, custom fixture designs, product catalogs, shopper simulation, the EV concept workbench and bounded analytical revision loop were built during the event as well.

Third-party pieces we did not write:

| Component | Used for |
|---|---|
| Muse Spark via Meta Model API | image interpretation, scene proposals and rule hypotheses |
| [`openai`](https://github.com/openai/openai-python) Python SDK | only as the client for Meta's OpenAI-compatible endpoint; no OpenAI models are used |
| [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) | downloading Creative Commons clips (`fetch`) |
| [`pytest`](https://pytest.org) | tests |
| [Three.js](https://threejs.org) | World Studio WebGL rendering and camera controls |
| Next.js, React, Zod and Lucide | Web framework, scene validation and interface icons |
| tsx | Offline World Studio TypeScript tests |

Any third-party video clip is credited from the attribution file `fetch` writes.

## License

MIT
