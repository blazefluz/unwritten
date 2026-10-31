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
`examples/synthetic-workflow.json` is explicitly synthetic scripted data, not real model output. No real general-workflow accuracy has been established. Downloaded warehouse footage is a candidate, not evaluated evidence.

## Brand Commitments
Name: Unwritten. User disliked the report's appearance and requested a Next.js UI. No visual reference or colour preference was supplied.

## Product Principles
Keep evidence traceable. Make uncertainty visible. Do not present synthetic data as real observations. Preserve original reviews and distinguish expert answers from independent verification.
