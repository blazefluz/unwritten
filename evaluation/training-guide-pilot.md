# Training-guide development pilot — November 2, 2026

This is a recorded development exercise using a published cable comparison,
not independent business validation. It demonstrates the new review workflow.
It does not establish a novel learning algorithm, authenticated expert approval,
generalization, time savings or an advantage over a strong mathematical baseline.

## Evidence and provenance

The cable features are the earlier real Meta readings from pileofstuff's CC BY
[testing USB charging cables](https://www.youtube.com/watch?v=5HsQNCVYYvM).
Training, question and validation preference labels were transcribed by the
coding assistant from the creator's published ordering. These comparisons and
reference labels had already been used during development. The proposal model
requests did not receive validation labels, but this is not a fresh confirmatory
test and the reviewer was not blind to the published results.

The dataset contains three training comparisons, one reserved question and three
validation comparisons. Some comparisons reuse a known reference cable, so raw
comparison counts must not be treated as independent physical-item counts.

## Failure preserved, then revised

The initial real Meta proposal produced four rules fitting all training cases.
All four predicted `right` for the reserved negative-versus-positive question.
They therefore did not generate a disagreement question. This exposed an
incomplete-candidate-set failure, not a successful automatic discovery.

That initial study is preserved in `training-cable-initial.session.json`.
During development we added a labelled reserved spot-check when all candidates
agree, prioritizing feature values outside observed training ranges. The
published-reference answer was `left`; deterministic checks rejected all four
initial candidates and prevented freezing any of them.

One real Meta revision request then received the attributed answer, explanation
and original failed candidates, with no validation outcomes. It proposed four
new consistent candidates, including a magnitude comparator. The original
candidate lists and the original direct Meta baseline were preserved. A coding
assistant selected the symmetric magnitude rule in **demonstration-only** review,
explicitly noting use of general electrical knowledge and lack of expert approval.
This selection is an additional review intervention, not a benefit attributable
solely to question selection.

## Frozen result

Predictions were stored on the local server before the three validation outcomes
were entered through the app. Code computed:

| Method | Correct / all 3 | Answered | Abstained |
| --- | --- | --- | --- |
| Demonstration-reviewed guide | 3/3 | 3 | 0 |
| Committee agreement before feedback | 1/3 | 1 | 2 |
| Committee agreement after feedback/revision | 2/3 | 2 | 1 |
| Original direct Meta baseline, no question answers | 2/3 | 3 | 0 |
| Training-majority baseline | 1/3 | 3 | 0 |
| Predeclared absolute-voltage comparator | 3/3 | 3 | 0 |

Four candidates existed before and after revision; they are different sets.
The remaining disagreement shows that one reference answer did not uniquely
identify a policy. The committee still abstains on one validation comparison.
The selected guide tied the strong baseline. Three development comparisons
are insufficient to support a performance or ROI claim.

The result, reviewer note, full candidate history, direct baseline, frozen ID and
fingerprint are in `training-cable-final.session.json`. The exported guide is
`training-cable-guide.md`. Reviewer attribution explicitly says demonstration,
not professional approval. Business-time fields are blank.

Legacy metadata note: the recorded study's `provenance` string described the
initial proposal/baseline phase. It must not be read as saying that the later
revision received no question answer. The revision history and attributed answer
show that it did. The current code makes this phase distinction explicit.

## Controls checked

- Model proposal uses training labels; revision may add attributed question answers.
- Validation labels are excluded from proposal, revision and direct baseline calls.
- Rule consistency, spot-check selection, abstentions and scores are computed by code.
- No inconsistent rule can be frozen; prelabelled validation cases cannot be frozen.
- Changed features/scope/training inputs invalidate a study or frozen snapshot.
- The server retains the first scored labels and refuses silent corrections.
- Synthetic fixtures and their scripted direct predictions stay visibly synthetic.
- Imported validation scores are not displayed until rerun against the local snapshot.

The shared-candidate-set failure was discovered and fixed during this exercise.
The next evaluation should use a **new recording and new cases with an independent
reference reviewer**, without changing the protocol after seeing outcomes. Follow
[business-pilot-protocol.md](business-pilot-protocol.md) for a partner study.
