# AGENTS.md — context for coding agents (Codex, Muse Code, etc.)

## What this project is
**Unwritten** learns the unwritten rules experts follow, by watching a video of them work.
Entry for the **Meta Global AI Developer Hackathon**, **Indie Developer track**
(judged on creativity, technical ambition, and whether it works).
Theme: **Build for Your World** (warehouse returns sorting). Solo builder: Victor (GitHub: blazefluz).

The user expanded the product to **any observed task**. Warehouse sorting and
repair are examples, not exclusive domains. `python -m unwritten analyze` runs the
general workflow in `unwritten/workflow.py`: observe actions, infer principles,
review supplied reference excerpts, validate citations in code, revise, and ask
the expert. Preserve the distinction between observations, hypotheses, model
assessments and expert testimony. Exact citations establish provenance, not
semantic truth, compliance or diagnostic accuracy. The original sorting CLI is
still supported.

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
- Done: general workflow CLI and HTML/JSON notebook, reference citation validation,
  bounded revision history, cached observations and expert-answer reanalysis.
  30 offline tests pass. `examples/synthetic-workflow.*` is explicitly synthetic;
  no real general-workflow result has been measured. References currently accept
  UTF-8 .txt/.md excerpts; PDF ingestion and automatic source discovery are not implemented.
- Done: Next.js workspace in `web/` (user-requested UI). Start with
  `npm ci --prefix web` then `npm run dev` (127.0.0.1:3040). It opens saved
  workflow JSON, plays a locally attached source video, exposes citations/history,
  and exports expert answers. `/api/analyze` invokes `unwritten.web_bridge` locally;
  credentials are server-only in `web/.env.local`. 32 offline Python tests pass.
  Run `npm run build` and `npm run typecheck` for UI changes. Real Meta validation
  is still pending. Browser drafts are not persisted unless exported.

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
