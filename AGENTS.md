# AGENTS.md — context for coding agents (Codex, Muse Code, etc.)

## What this project is
**Unwritten** learns the unwritten rules experts follow, by watching a video of them work.
Entry for the **Meta Global AI Developer Hackathon**, **Indie Developer track**
(judged on creativity, technical ambition, and whether it works).
Theme: Push the Frontier / Build for Your World. Solo builder: Victor (GitHub: blazefluz).

Pipeline (see README.md):
1. OBSERVE — Muse Spark watches an mp4 and logs every decision (time, item, attributes, outcome).
2. HYPOTHESIZE — Muse Spark proposes the simplest ordered decision list.
3. CHECK — deterministic code (`unwritten/rules.py`) scores the rules. Never let the model self-report accuracy.
4. REVISE — counterexamples go back to the model; it fixes rules or flags a suspect observation with a reason.
5. PREDICT — rules from the first ~60% of events (chronological split) predict the rest.
6. COMPARE — OneR baseline (best single-attribute lookup, no AI).
7. ASK — model asks the expert targeted questions where evidence is thin (`coverage()` computes where).
Output in `labs/`: `<clip>.lab.html` notebook, `<clip>.live.html` player, `<clip>.lab.json`.

## Hard rules from the hackathon (do not break)
- **The app's AI must be Meta's models** (Meta Model API: Muse Spark `muse-spark-1.3`, SAM 3.1,
  Muse Voice Transcribe, or Meta open-weight models). Do not add OpenAI/Anthropic/other models
  to the product. The `openai` Python package is used only as the SDK for Meta's
  OpenAI-compatible endpoint (`https://api.meta.ai/v1`). Unclear whether writing code with
  non-Meta coding agents is allowed: ask in the hackathon Discord #questions.
- Repo must be **public**; all work must be built during Oct 27 – Nov 4, 2026 (keep commit history).
- Submission due **Wed Nov 4, 9:00 PM ET** with a **3-minute demo video**.
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

## Status (as of Oct 30, 2026)
- Done: engine, CLI (`serve`, `observe`, `learn`, `run`, `eval`, `check`, `fetch`), local app
  (`unwritten/server.py`), live prediction player (`unwritten/live.py`), expert answers that revise
  and re-score the rules, evaluation against hand labels (`unwritten/evals.py`), labelled synthetic
  sample, offline tests (`python -m pytest -q`).
- NOT done: anything against real Muse Spark. `client.py` has never made a live call, so the go/no-go
  on observation accuracy is still open. This needs `MODEL_API_KEY`.
- Open question: are non-Meta coding agents allowed? Ask in the hackathon Discord #questions.

## Next steps, in priority order
1. `python -m unwritten check`, then a real run on a 1–2 min sorting clip; inspect the observation log.
   If poor, try shorter clips, `--context`, or sampling keyframes.
2. Eval set: 3–5 clips with hand labels in `evals/`; put the numbers in the README.
3. Optional: SAM 3.1 to highlight the item being sorted.
4. Nov 3: record the demo (`docs/DEMO.md`). Nov 4: README polish, submit.

## Conventions
- Python 3.10+, standard library + `openai` SDK only in the core; keep model calls in `client.py`.
- Every model call goes through `MetaClient.ask_json(prompt, schema, name, video=None)`.
- Keep tests offline (FakeClient in `tests/test_engine.py`). Run `python -m pytest -q` before committing.
- Label synthetic or sample data clearly; never present it as real model output in the demo.
