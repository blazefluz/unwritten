# Unwritten

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js App Router and React in `web/`; Python standard library plus the OpenAI-compatible SDK for Meta in `unwritten/`. Local Next.js server invokes the Python engine. User explicitly requested a Next app for the UI.

## Product Purpose
Learn the unwritten decision principles behind observed expert work. Tasks are not restricted to warehouses or lawn mowers. Observe a video, infer principles, check applicable supplied references, preserve revisions, and ask the expert.

## Capabilities and Constraints
Only Meta models perform product AI calls. Code checks citation provenance, not semantic correctness. Separate observations, hypotheses, model assessments and expert testimony. Reference excerpts accept UTF-8 text and Markdown. PDF ingestion and source discovery are not implemented. Review JSON can be opened locally; video can be attached for local playback. New analyses upload video and supplied references to Meta through the local Python engine. API credentials stay on the server.

## Evidence on Hand
`examples/synthetic-workflow.json` is explicitly synthetic scripted data, not real model output. A first full-video Meta repair run has completed, but the user rejected the observations as unhelpful. A qualitative audit identified missing narration and unsupported interpretations of action purpose. No real general-workflow accuracy has been established. Downloaded warehouse footage is a candidate, not evaluated evidence.

## Offline Preparation and Evaluation
The Decision test workspace supports human correction of event observations, local video seeking, action-category labels, draft import/export, local recovery and a one-change undo. Chronological evaluation freezes rules learned on the prefix and predicts later actions from earlier events. Code scores predictions against human labels and reports a training-majority baseline and abstentions. Imported score arithmetic is validated, not the authenticity of model execution. Results carry input fingerprints. Expert answers can trigger a new Meta reference review while retaining earlier rounds. All paid operations remain disabled until the server has a Meta API key. A Muse Code subscription does not fund the Model API.

## Brand Commitments
Name: Unwritten. User disliked the report's appearance and requested a Next.js UI. No visual reference or colour preference was supplied.

## Product Principles
Keep evidence traceable. Make uncertainty visible. Do not present synthetic data as real observations. Preserve original reviews and distinguish expert answers from independent verification.

## Narration evidence
Optional timestamped text transcripts accompany the video. Preserve their source and fingerprint. Each event separates visible evidence from the speaker’s explanation; narration and automatic captions are testimony and may be wrong. Do not treat a caption-assisted rerun as measured accuracy or validated repair advice.
