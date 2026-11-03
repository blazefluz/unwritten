# Repair observation audit — November 2, 2026

Source: Bruce's Shop, “John Deere 14PZ Push Mower, Intermittent Start”,
https://www.youtube.com/watch?v=J1Xp2wv3tc0. The first 180 seconds were downloaded
through the CC-checking helper with attribution. This is a qualitative audit,
not hand-labelled ground truth or a measured accuracy result.

The first full-video Meta call produced eight events and four hypotheses. The
user rejected the observations as unhelpful. Inspection found that generic body
movements obscured the diagnostic sequence, and inferred principles sometimes
assigned purpose from order or posture alone.

| Interval | Initial output | Missing distinction |
| --- | --- | --- |
| 0:16–0:33 | Stationary mower presentation | Automatic captions report the owner's complaint: it will not restart after a pause during mowing. This is a reported symptom, not a reproduced result. |
| 0:40–0:55 | Handlebar manipulation | Captions discuss limited cable travel and uncertainty about whether it is enough. Narration provides an interpretation that the image alone cannot establish. |
| 0:55–1:18 | Hands contacting the engine | Captions state an intention to prime the engine. “Hands on housing” loses that task context. The exact visible component and operation still need checking. |
| 2:24–2:44 | Tilt to expose side/underside | Captions discuss the engine, its tag and age. Sampled frames show contact near the engine at 2:36 and a mower tilt at 2:41. A tilt is visible; calling its purpose an underside inspection is not established. |
| 2:55–3:00 | Cloth contacting the engine | Captions state an oil check. The clip ends before the later spoken level assessment; do not import that later assessment into this clip. |

Captions were exported from YouTube and are **auto-generated**, with obvious
transcription errors. They are contextual testimony, not independent verification.
Only caption entries before 3:00 were supplied to the rerun. The full original
video contains later diagnosis and repair, which are outside this sample.

Changes: keep visible evidence and speaker explanation in separate event fields;
preserve transcript text and fingerprint; discourage principles based only on
filming, repositioning or temporal adjacency; permit an empty hypothesis list.
Original artifacts are retained under `clips/mower-repair/first-real-run-nov2.*`;
the rerun uses a separate `caption-assisted-nov2.*` prefix. Both are local,
unscored model outputs. Do not use either as ground truth for prediction accuracy.
