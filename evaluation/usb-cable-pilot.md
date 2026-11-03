# USB cable pilot — November 2, 2026

Result: a small perception-to-rule-to-comparison pipeline completed with real
`muse-spark-1.3` calls. This is a constrained numeric preference pilot, not evidence
that Unwritten learns general expert skill or outperforms a simple heuristic.

Source: [testing USB charging cables](https://www.youtube.com/watch?v=5HsQNCVYYvM)
by pileofstuff, Creative Commons Attribution license (reuse allowed), verified on
YouTube and by the `fetch` helper. Downloaded excerpt: original 5:25–8:40.

| Check | Result |
| --- | --- |
| Cable count and order | Seven tests identified in the expected chronological order |
| Magnitudes versus creator's rounded written labels | 7/7 within a preselected ±0.05 V tolerance and the marked time windows |
| Training | First four observed signed readings, with six within-training preferences |
| Held-out comparison agreement | 12/12, from three held-out cables compared with four training cables |
| Absolute-voltage baseline | 12/12 on those same comparisons |
| Abstentions | 0 |

Selected signed readings: c1 4.492, c2 -4.5143, c3 4.3069, c4 4.7139,
c5 -3.5029, c6 -4.4689, c7 -4.1647 volts. The frozen comparator selected by
Meta was “higher absolute value is preferred.” Code, not the model, computed
all comparison scores. Negative signs were retained during observation.

Leakage controls: the observation input was a silent 127-second measurement
excerpt; its audio and the later final ranking were absent. Rule inference
received no video, transcript, held-out IDs/readings/preferences or final order.
The actual saved request was checked for exclusion of c5–c7. After rule inference,
code applied the comparator to held-out observed measurements without feedback.

References were transcribed by the coding assistant from the creator's final
written labels and ordering, not independently verified by a human annotator.
Readings vary with probe contact; the tolerance is agreement with rounded labels,
not calibrated instrument accuracy. Twelve pairs share only three held-out
cables and are not twelve independent cases. The model was offered only a
numeric transform/direction comparator family. Its prior knowledge cannot be
excluded, regardless of its self-reported reasoning.

This clip validates a narrow pipeline and exposes a clear baseline tie. It does
not establish a novel expert rule, a pass/fail voltage threshold, manufacturer
compliance, constant-current testing, or repair success. A stronger demonstration
needs multiple relevant signals, genuine exceptions and additional held-out work.

Reproduction (paid Meta calls; cached perception is reused):

```sh
.venv/bin/python -m evaluation.run_usb_pilot
.venv/bin/python -m evaluation.render_usb_pilot
```

Original results and request traces are preserved locally in the ignored
`clips/usb-cable-tests/pilot-nov2/` folder. The runner refuses to overwrite its
completed report. The HTML report includes source playback, all perception checks,
all twelve comparisons, baseline, limitations and raw JSON links. This ranking
pilot is separate from the Next.js workspace's chronological next-action test.
