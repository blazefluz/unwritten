# Fresh zipper-repair video smoke test

Source: “How To Fix A Zip | Clothes Doctor X Zalando”, Clothes Doctor: Love Your
Clothes Longer, https://www.youtube.com/watch?v=k_YyHODQ-oI.
Creative Commons Attribution verified by `python -m unwritten fetch`; attribution
is preserved beside this note. Downloaded range 0–81 seconds.

## Recorded before the model run

Sampled frames at eight-second intervals show three different settings: a black
bag with a metal loop/pull, a brown bag with needle/thread work, and a garment at
a sewing machine. This is a visual smoke-test checklist, not exhaustive ground
truth or an expert diagnosis. Expect the analysis to distinguish those settings,
identify tools/actions cautiously, and keep inferred repair principles tentative.
Do not assume a failure cause, manufacturer-approved procedure or permanent
repair success from these frames.

Run through the Next.js New analysis form using Meta Muse Spark. No supplied
transcript, references or expert answers. This tests fresh video ingestion and
workflow output, not held-out training-guide accuracy or business benefit.

## Actual run result — November 2, 2026

The app completed the real Meta run: **10 events, 1 tentative principle, 1 expert
question, no references and no expert answers**. Only events e1–e5 are linked to
the principle. The hand-sewing and machine-sewing sequences are observed but have
no learned decision principle. The reference assessment is correctly inconclusive.

The broad three-setting sequence matches the pre-run sampled-frame checklist.
That is a qualitative check by the coding assistant, not independent event-level
accuracy measurement. Detailed action wording, timestamps and repair outcomes
remain unverified; no accuracy percentage is claimed. Speaker explanations were
empty in this run. No transcript was supplied.

Browser checks: selecting e8 sought to 00:51 and displayed the sewing-machine
observation, uncertainty and “No principle linked yet”; selecting e4 sought to
00:09 and displayed the linked tentative principle and expert question. JSON
export completed and parsed identically to the server's saved workflow.

Preserved files: `observations.json`, `workflow.json`, `smoke-test.json`.
This is a successful ingestion/review/export smoke test with partial reasoning
coverage, not a validated repair policy, manufacturer check, unseen-case score
or business pilot. No code changes were needed. Next: obtain attributed repair
explanations or expert answers before attempting a reviewable training guide.
