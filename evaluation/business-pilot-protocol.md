# Validate the training-guide proposition

## Claim being tested

For one defined inspection/triage task at one operation, can a reviewed guide
capture the senior operator's decisions, resolve uncertain cases with targeted
questions, and help a newcomer make better decisions with less supervision?
This is a proposed business claim, not a result established by our video pilots.

## First partner and task

Choose a returns processor or electronics refurbisher with a repeatable decision,
an available senior reviewer, visible inputs and an existing process to compare
against. Specify the site, product family, equipment and policy edition. Capture
permission to record/share the footage and remove customer-identifying material.
A published YouTube comparison cannot substitute for this partner validation.

## Before collecting outcomes

- Agree on outcome labels and which features are available **before** each decision.
  Exclude anything only learned after the outcome or directly encoding that outcome.
- Define the unit: preferably one physical returned item. Do not count repeated
  views or several comparisons of the same item as independent examples.
- Reserve training, question and validation items before reviewing their outcomes.
  Use different physical items and preferably a separate recording/session for
  validation. Keep difficult cases in the evaluation rather than dropping them.
- Agree with the partner on acceptable error costs and coverage. A fast guide that
  increases costly false accepts is not a successful pilot. Do not invent a universal
  safety/compliance threshold.
- Record the existing training method, instructions, time and decision quality.

## Technical experiment

1. Have a reviewer independently annotate observable inputs and decisions. For
   numerical extraction, define allowable tolerance before the model call.
2. Audit observation accuracy separately from policy accuracy. Correcting model
   observations before policy evaluation produces an assisted-input result and must
   be reported as such, alongside the uncorrected extraction result.
3. Propose competing rules from training labels only. Run a direct Meta baseline
   with the same training information and validation features, without question answers.
4. Code selects a reserved question case where consistent rules disagree. If all
   agree, a separately labelled coverage spot-check can probe an out-of-range case;
   consensus is not proof. Record
   the actual expert/reference source, outcome and explanation. Keep eliminated rules
   and counterexample IDs visible. A supplied answer is testimony, not independent truth.
5. Review one consistent rule and its limits. Freeze the guide and predictions on
   the local server before entering validation outcomes. Demo review is explicitly
   different from expert self-attestation; identity and expertise are not authenticated.
6. Enter attributed validation outcomes once. Code scores all reserved cases,
   including abstentions; the first scored labels are preserved. Corrections must
   be documented in a new study, not silently overwrite the result.
7. Report reviewed-guide agreement, committee coverage before/after questions,
   direct Meta performance, majority baseline and a strong task-specific baseline.
   Report ties and regressions. The cable pilot's magnitude baseline is deliberately
   included because simple physics may already solve that task.

Start with a small usability pilot, then collect a larger independent validation
set (for example 30 or more physical items) before drawing performance conclusions.
Thirty is a planning example, not a statistical guarantee. Report raw counts,
uncertainty and dependence between samples rather than a headline percentage alone.
A second operator/session tests transfer more meaningfully than repeating one clip.

## Human training experiment

Compare newcomers using the existing instructions with newcomers using the guide.
Use comparable unseen case sets and counterbalance the order if the same people
try both methods. Record time, correct decisions, serious errors, supervisor
interruptions, abstentions and whether the user can explain exceptions. Keep the
reference reviewer separate from the novice's decisions where possible.

The app's optional before/after training-minute fields are self-reported notes,
not a controlled experiment or automatic ROI calculation. Leave them empty until
measured. Do not claim cost savings from model agreement alone.

## Current scope

Implemented: attributed cases and structured pre-decision features; separate
training/question/validation roles; bounded Meta-proposed decision lists; deterministic
rule checking and disagreement selection; attributed expert answers; self-attested
review; immutable local guide snapshots; locked first validation labels; baseline
comparison; session/guide/result exports; local draft recovery.

Not established: independent expert approval, real business deployment, reduced
onboarding time, improved economics, manufacturer compliance, broad generalization
or automatic capture of every relevant feature from arbitrary videos. The video
review remains a source for cases; a reviewer currently defines the structured
features and reference decisions used by the guide engine.
