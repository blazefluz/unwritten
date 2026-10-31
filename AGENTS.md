# AGENTS.md — context for coding agents (Codex, Muse Code, etc.)

## What this project is
**Unwritten** learns the unwritten rules experts follow, by watching a video of them work.
Entry for the **Meta Global AI Developer Hackathon**, **Indie Developer track**
(judged on creativity, technical ambition, and whether it works).
Theme: **Build for Your World** (warehouse returns sorting). Solo builder: Victor (GitHub: blazefluz).

Pipeline (see README.md):
1. OBSERVE — Muse Spark watches an mp4 and logs every decision (time, item, attributes, outcome).
2. HYPOTHESIZE — Muse Spark proposes the simplest ordered decision list.
3. CHECK — deterministic code (`unwritten/rules.py`) scores the rules. Never let the model self-report accuracy.
4. REVISE — counterexamples go back to the model; it fixes rules or flags a suspect observation with a reason.
5. PREDICT — rules from the first ~60% of events (chronological split) predict the rest.
6. COMPARE — OneR baseline (best single-attribute lookup, no AI).
7. ASK — model asks the expert targeted questions where evidence is thin (`coverage()` computes where).
Output: `<clip>.lab.html` notebook + `<clip>.lab.json`.

## Hard rules from the hackathon (do not break)
- **The app's AI must be Meta's models** (Meta Model API: Muse Spark `muse-spark-1.3`, SAM 3.1,
  Muse Voice Transcribe, or Meta open-weight models). Do not add OpenAI/Anthropic/other models
  to the product. The `openai` Python package is used only as the SDK for Meta's
  OpenAI-compatible endpoint (`https://api.meta.ai/v1`). Unclear whether writing code with
  non-Meta coding agents is allowed: ask in the hackathon Discord #questions.
- Repo must be **public**; all work must be built during Oct 26 – Nov 4, 2026 (keep commit history).
- Submission due **Wed Nov 4, 9:00 PM ET** with a **3-minute demo video**.
- The demo must show only what was built during the event, and judges must be able to tell
  what is new: README "Built during the hackathon" lists our work and the third-party pieces.
- Do not use sports footage (sports analyzers/coaches are a banned category); show the
  rule-learning loop, not just labels on frames, so it doesn't read as a simple image analyzer.
- Only use assets we have rights to. YouTube clips: Creative Commons only, via
  `python -m unwritten fetch` (checks the license, writes attribution JSON). Prefer self-filmed clips.
- Banned categories include simple image analyzers, basic RAG, medical advice, sports coaches.
  The rule-learning loop and verification are what keep this out of "simple image analyzer".

## Meta Model API notes (verified from dev.meta.ai docs)
- Base URL `https://api.meta.ai/v1`, env var `MODEL_API_KEY`, model `muse-spark-1.3`.
- Video: mp4 only. Upload via Files API (`purpose="user_data"`, ≤1 GiB) and reference with
  `input_file` + `file_id`, or `input_video` + `video_url` for a public URL (inline ≤50 MB).
- Structured output on the Responses API: `text={"format": {"type": "json_schema", "name", "schema"}}`.
  No recursive schemas.
- Reasoning shares the output token budget: keep `max_output_tokens` high.

## Status (as of Oct 31, 2026)
- Done: engine, CLI (`observe`, `learn`, `run`, `play`, `fetch`), HTML notebook, prediction
  player (`unwritten/player.py`), 11 offline tests (`python -m pytest -q`) using a fake model
  client and synthetic fixture data.
- Done: public GitHub repo `blazefluz/unwritten`.
- NOT done: first real run against Muse Spark on a real video (go/no-go test of observation accuracy).

## Next steps, in priority order
1. Real run on a 1–2 min sorting clip; inspect the observation log accuracy. If poor, try shorter
   clips, `--context`, or sampling keyframes.
2. Small eval set: 3–5 clips with hand-labelled ground truth; report observation and prediction accuracy.
3. Done: "predict before it happens" player (`python -m unwritten play`). Check it on the
   first real clip; tune when the prediction appears if the logged times are off.
4. Interactive answers to the expert questions that update the rules and re-score.
5. Optional: SAM 3.1 to highlight the item being sorted in each frame of the notebook/video.
6. Nov 3: record the 3-minute demo. Nov 4: README polish, submit.

## Conventions
- Python 3.10+, standard library + `openai` SDK only in the core; keep model calls in `client.py`.
- Every model call goes through `MetaClient.ask_json(prompt, schema, name, video=None)`.
- Keep tests offline (FakeClient in `tests/test_engine.py`). Run `python -m pytest -q` before committing.
- Label synthetic or sample data clearly; never present it as real model output in the demo.
