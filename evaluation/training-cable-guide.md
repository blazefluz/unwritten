# USB cable comparison · published-video pilot

Status: DEMONSTRATION ONLY

Task: Capture a reviewable guide to predicting which of two tested cables the creator ranks higher.

Scope: One published video by pileofstuff (CC BY), one resistive test setup. Values are prior Meta observations; preference labels are assistant transcriptions of published ordering, not independently expert-verified. Not electrical compliance or real business validation.

Reviewer: Coding assistant — demonstration reviewer, not an electronics expert

Review note: Development pilot on published cable comparisons only. Candidate selected using general electrical knowledge, not an expert attestation. Reference preferences were transcribed by the coding assistant and these cases were used in earlier development. No manufacturer compliance, new-device generalization, real business adoption or ROI is established. Missing evidence and ties must abstain.

Self-attestation only; identity, expertise, operating safety and compliance are not verified.



## Decision guide

1. If magnitude of Left cable voltage (V) is greater than magnitude of Right cable voltage (V): **left**.

2. If magnitude of Right cable voltage (V) is greater than magnitude of Left cable voltage (V): **right**.

Otherwise: Ask the expert; no prediction.

Unknown or incomparable evidence: ask the expert.



## Evidence and limitations

Training cases: train-1, train-2, train-3, question-1

Model proposal: Visible: train-1 left 4.7139 vs right 4.492 -> left; train-2 left 4.3069 vs right 4.492 -> right; train-3 left 4.492 vs right 4.3069 -> left; question-1 left -4.5143 vs right 4.492 -> left. Testimony for question-1 (not independently verified): written labels 4.51 and 4.48, negative meter sign not used in published ordering. Inferred (not visible): creator ranks higher magnitude higher, ignoring sign. Raw higher-wins fails question-1, so replaced with absolute version. Exact tie not observed, so tie is underdetermined - abstain.

Guide version: 5db9c683-1665-4f9c-8c9a-263ffb50017d

Fingerprint: 25d337b13055ccf9b5f07c68626b25fd6ebb8307680daa795a518f5c5e0fe563

This captures reviewed practice for the stated scope; it is not manufacturer authorization or a compliance finding.
