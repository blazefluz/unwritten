# Unwritten

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Next.js App Router and React in `web/`; Python standard library plus the OpenAI-compatible SDK for Meta in `unwritten/`. Local Next.js server invokes the Python engine. User explicitly requested a Next app for the UI.

## Product Purpose
Capture experienced operators’ inspection and triage decisions as a reviewable training guide for newcomers. Initial potential users are returns processors and electronics refurbishers. Tasks remain general; warehouses, repair and cable testing are examples. Video supplies case evidence; reviewers define pre-decision features, resolve disputed outcomes, review a proposed guide and validate it on reserved cases.

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

## Training guide proposition
Training guide is the primary workspace. It prepares attributed training, question and validation cases; proposes competing decision lists with Meta; checks them in code; selects questions by disagreement; records expert testimony; and freezes a reviewed guide before validation labels. Snapshots and first scored labels are preserved on the local server. Scores compare the reviewed guide, committee agreement before/after questions, direct Meta with no question answers, a training-majority baseline and an optional declared task baseline. Expert review is self-attested, with a separate demonstration-only mode. The app does not authenticate reviewer expertise or certify compliance.

Published cable data and scripted synthetic exercises are explicitly labelled. Neither establishes business adoption or ROI. Optional training-minute fields remain empty until measured. The business-pilot protocol in evaluation/ defines how to test newcomer training time, error quality and supervisor interventions with an independent reference reviewer.

## Development-pilot outcome
The new guide loop was exercised with real Meta proposals, one published-reference answer, one revision, demonstration-only review and server-frozen validation. The first four candidate rules shared a wrong assumption; a coverage spot-check rejected them all. The selected revised guide agreed on 3/3 development comparisons, direct Meta on 2/3 and the predeclared magnitude baseline on 3/3. Committee coverage improved from 1/3 to 2/3 and one case remained unresolved. These are reused development cases with assistant-transcribed labels and an additional reviewer selection intervention; no business or generalization claim is established. See evaluation/training-guide-pilot.md.

## World Studio branch experiment
The user authorized a separate spatial-creation prototype at `/studio`: an embodied avatar collaborates on a catalog-based 3D room, with natural-language scene edits through Meta and deterministic footprint checks. Existing Unwritten routes remain available. Initial scope is one room, ten procedural object types, selection-based contextual editing, camera navigation, undo and local JSON persistence. No physics, mesh generation, structural validation or market demand is established. Local parser and example layouts must remain clearly distinguished from actual Meta output. See docs/world-studio.md.
