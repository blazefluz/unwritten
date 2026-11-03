---
name: Unwritten workspace
description: A video-first workspace for reviewing observed decisions and their evidence.
colors:
  canvas: '#F7F7F8'
  surface: '#FFFFFF'
  ink: '#202124'
  muted: '#686A70'
  line: '#E5E5E8'
  accent: '#FF4F00'
  accent-ink: '#A73200'
  soft: '#FFF1EB'
  green: '#266043'
  green-bg: '#EEF6F0'
  amber: '#805A17'
  amber-bg: '#FBF4E6'
  red: '#A33131'
  red-bg: '#FBEFEF'
typography:
  body:
    fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif'
    fontSize: '14px'
    lineHeight: 1.55
rounded:
  control: '6px'
  workspace: '10px'
spacing:
  small: '8px'
  medium: '16px'
  large: '24px'
---

## Overview
**Creative North Star: "The Evidence Workspace"**

Swiss direction: neutral white surfaces, proportional sans typography, hairline divisions, one orange selection accent. The first surface is an operating workspace, not a printed report. System fonts keep the local app independent of remote font services.

**Key Characteristics:**

- Neutral surfaces with hairline divisions.
- Connected video, observed actions and reasoning.
- Orange selection with explicit evidence labels.

## Colors
Orange marks selection and primary actions. Selected surfaces use pale orange and dark orange text; primary action text uses dark ink. Assessment badges use subdued semantic colours and explicit “Model assessment” text, including revision history. Synthetic examples remain labelled at the title and in context.

## Typography
One sans family throughout. Tabular numerals for times; monospace only for document fingerprints. Body text uses dark ink or muted grey with readable contrast.

## Layout
Desktop: persistent navigation, source video and event timeline beside focused reasoning and citations. The sticky desktop sidebar is 216px wide, narrowing to 180px at 1150px. At 900px navigation moves above the workspace as a locally scrollable row; the page stays within the viewport. At 680px the video and reasoning stack. Main content is capped at 1550px with 38px desktop and 16px mobile horizontal padding. The observed-action list scrolls locally with a 310px maximum height. Reference documents, history and expert questions have dedicated views.

## Elevation & Depth
Use borders to define surfaces. No decorative shadows or gradients.

## Shapes
Six-pixel controls and ten-pixel workspace corners. Badges are small labels, not buttons.

## Components
Neutral buttons use outlined white surfaces; hover shifts them to the canvas tone. Primary analysis buttons use orange and deepen on hover. Focus-visible controls use a two-pixel dark-orange outline with four-pixel offset. Disabled buttons reduce opacity. Inputs have thin grey borders and six-pixel corners; mobile analysis fields use 16px text. Selected events use a pale-orange fill and one-pixel orange leading edge. Mobile navigation selection uses an orange underline. All visible controls must work. New analysis invokes the Python engine; missing API setup is shown explicitly. Local video preview does not recompute observations. Export JSON and expert answers are separate actions. Exact citations link to the supplied reference view.

Motion is limited to brief background hover transitions and a loading spinner. Reduced-motion preferences disable animations, transitions and smooth scrolling. Empty video states use simple icons; imagery comes from supplied video.

Decision test uses the same document surface, with collapsible event forms, local
video playback and time-seek controls. Keep action labels separate from observed
evidence. Show the training/test counts and request count before a paid test.
Evaluation results pair the main score with the baseline, abstentions and every
prediction. Draft source and synthetic warnings must remain visible. Local drafts
and expert answers survive refreshes; export remains available as a backup.

## Do's and Don'ts

- Do preserve synthetic labels and uncertainty beside their evidence.
- Do keep observations, inferences, model assessments and expert testimony distinct.
- Do show that exact citations establish source text, not interpretation.
- Do keep navigation scrolling local on narrow screens.
- Don't fabricate telemetry, thumbnails, analysis progress or accuracy.
- Don't substitute invented imagery for missing source video.

## Training guide workspace
The primary view presents four stages: prepare cases, ask the expert, review and freeze, and validate. White document surfaces, Helvetica and the existing orange accent remain unchanged. Case inputs use meaningful feature labels rather than requiring JSON editing. Rule cards show competing explanations, rejected alternatives and their counterexample IDs. The selected disagreement case leads to an attributed answer form. Review distinguishes demonstration-only status from reviewer self-attestation. Validation labels stay locked until a server snapshot exists; predictions stay visually hidden until scoring, and first scored labels cannot be silently changed. Baselines and abstentions remain beside the main score. Business-time measurements are separate, optional and initially empty.
