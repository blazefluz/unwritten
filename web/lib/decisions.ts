import { z } from "zod";
const short = z.string().max(8000);
export const draftObservationSchema = z.object({source: short.optional(), task: short.optional(), events: z.array(z.object({
  id: short.min(1), time_start: z.number().finite().nonnegative(), time_end: z.number().finite().nonnegative(),
  action: short, visible_evidence: short, observed_result: short, speaker_explanation: short.optional(), uncertainties: z.array(short),
})).min(1).max(200)});
export const observationSchema = draftObservationSchema.superRefine((value, context) => {
  const ids = new Set<string>();
  value.events.forEach((event, index) => {
    if (ids.has(event.id) || event.time_end < event.time_start)
      context.addIssue({code: "custom", message: "Use unique event IDs and ordered timestamps.", path: ["events", index]});
    ids.add(event.id);
  });
});
export type Observation = z.infer<typeof observationSchema>;
export const decisionSchema = z.object({kind: z.literal("workflow_decision_evaluation"),
  source: short.optional(), task: short.optional(), input_sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  train_fraction: z.number().gt(0).lt(1).optional(), training_event_ids: z.array(short.min(1)).min(1), frozen_rules: z.array(short),
  predictions: z.array(z.object({event_id: short.min(1), time_start: z.number().finite().nonnegative(),
    prediction: short, actual: short.min(1), correct: z.boolean(), reason: short, uncertainty: short,
    baseline_prediction: short.min(1), baseline_correct: z.boolean()})).min(1),
  score: z.object({correct: z.number().int().nonnegative(), total: z.number().int().positive(),
    abstained: z.number().int().nonnegative(), baseline_correct: z.number().int().nonnegative()}),
  limitations: short,
}).superRefine((value, context) => {
  const rows = value.predictions;
  const ids = new Set(rows.map(row => row.event_id));
  if (new Set(value.training_event_ids).size !== value.training_event_ids.length || ids.size !== rows.length || value.training_event_ids.some(id => ids.has(id)) ||
      rows.some(row => row.correct !== (row.prediction === row.actual) ||
        row.baseline_correct !== (row.baseline_prediction === row.actual)) ||
      value.score.total !== rows.length || value.score.correct !== rows.filter(row => row.correct).length ||
      value.score.abstained !== rows.filter(row => !row.prediction).length ||
      value.score.baseline_correct !== rows.filter(row => row.baseline_correct).length)
    context.addIssue({code: "custom", message: "Evaluation scores or event partitions are inconsistent."});
});
export type DecisionResult = z.infer<typeof decisionSchema>;
