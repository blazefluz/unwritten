# First independent partner pilot — collection pack

Status: **not started**. These CSVs contain headers only. No partner, expert,
new recording, customer result or measured benefit is represented here.
Follow [the protocol](../business-pilot-protocol.md) for experiment design.

## Agree on one task

Use a repeatable inspection or triage decision with an available senior operator.
Electronics returns is a possible first setting; the product supports other tasks.
Before filming, record these answers in a private copy of this document:

- Partner/site and senior reviewer: **pending**
- Task, product family, equipment and policy edition: **pending**
- Recording, storage and demo-sharing permission: **pending**
- Outcome labels and costly errors: **pending**
- Observable features available before each decision: **pending**
- Missing-input handling and numeric tolerances: **pending**
- Existing instructions and task-specific baseline: **pending**
- Item/session split and exclusion rules agreed before outcomes: **pending**
- Partner's acceptance criteria for errors, coverage and training time: **pending**

Do not commit customer information, private recordings or completed private sheets.
Keep the completed copy in a partner-approved private location outside this repo.
Use pseudonymous participant/item IDs, not names or customer identifiers.

## Collect and freeze in this order

1. Record permissions and the decisions above. Choose different physical items
   for training, reserved questions and validation; prefer a separate validation
   session. Assign stable IDs in `case-register.csv`. Do not drop hard cases.
2. Independently annotate features and outcomes. Keep outcomes in
   `reference-labels-private.csv`, separate from the feature register. A person
   preparing references should avoid seeing model predictions. Never upload the
   private reference sheet as a prompt or reference excerpt.
3. Audit raw video extraction with `observation-audit.csv`. Agree tolerances first;
   record missed/extra events and unknown features. Report raw extraction and
   corrected-input policy results separately.
4. In Training guide → Prepare cases, enter the agreed outcomes/features and
   register cases. Copy source/time anchors from video review where useful. Enter
   labels only for training cases. These CSVs are collection sheets, **not app
   import files**; the app currently accepts its own project/session JSON.
5. Propose rules, record actual expert answers to reserved questions, and revise
   if needed. Ask the operator to review scope and exceptions. Use demo review
   until an actual expert has reviewed; self-attestation is not identity verification.
6. Freeze the guide and predictions **before** entering validation labels. Export
   the frozen session and guide, and record the freeze ID and fingerprint. Then
   enter attributed reference labels once and export scored results. Keep errors,
   abstentions and all baselines in the report. Archive label corrections as a new
   study with an explicit correction record.
7. Test newcomers against existing instructions using unseen comparable cases.
   Record each attempt in `newcomer-trials.csv`; counterbalance conditions when
   participants use both. Do not expose references to participants before decisions.

A pilot needs at least three attributed training cases plus reserved question and
validation cases to use the app. That is a software minimum, not adequate evidence
of generalization. Agree a useful sample size with the partner; the protocol's
30-item example is a planning aid, not statistical assurance.

## Result note to complete after measurement

- Frozen study ID / fingerprint / date: **pending**
- Unique physical items and sessions per split: **pending**
- Raw extraction errors and corrected inputs: **pending**
- Guide correct / total; answered / total; serious errors: **pending**
- Initial and revised committee, direct Meta, majority and task baseline counts: **pending**
- Newcomer errors, time and interruptions by condition: **pending**
- Exclusions, disagreements, dependence and limitations: **pending**
- Partner acceptance criteria met / unmet / inconclusive: **pending**

If results tie a simple baseline, report the tie. If the guide increases costly
errors, report that even when it is faster. Do not turn agreement on a small set
into a claim about onboarding savings or manufacturer compliance.

## Optional invitation draft — not sent

“We're testing Unwritten, a tool that turns examples of an experienced operator's
work into a reviewable training guide. Would you be willing to choose one small,
repeatable task and review a short pilot? We'd compare the guide with your existing
instructions on separate items and measure errors, time and interruptions. You
would control what may be recorded or shared. This is an experiment; we haven't
yet demonstrated business savings.”
