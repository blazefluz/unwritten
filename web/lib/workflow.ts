import { z } from "zod";

const text = z.string().max(180000);
const event = z.object({ id: text, time_start: z.number().finite().nonnegative(),
  time_end: z.number().finite().nonnegative(), action: text, visible_evidence: text,
  observed_result: text, speaker_explanation: text.optional(), uncertainties: z.array(text) });
const hypothesis = z.object({ id: text, event_ids: z.array(text), claim: text,
  reasoning: text, alternatives: z.array(text), expert_question: text });
const citation = z.object({ reference_id: text, line_start: z.number().int(),
  line_end: z.number().int(), quote: text, valid: z.boolean() });
const review = z.object({ hypothesis_id: text, proposed_assessment: text,
  assessment: z.enum(["supported", "conflicts", "inconclusive"]), explanation: text,
  applicability: text, citations: z.array(citation), validation_errors: z.array(text),
  human_review_required: z.boolean() });
const attempt = z.object({ hypotheses: z.array(hypothesis), reviews: z.array(review) });
export const workflowSchema = z.object({ kind: z.literal("workflow_analysis"), task: text,
  transcript: z.object({source: text, text, sha256: text}).nullable().optional(),
  source: text, events: z.array(event).min(1).max(10000),
  references: z.array(z.object({id: text, title: text, declared_scope: text,
    sha256: text, lines: z.array(text)})), expert_answers: z.record(z.string(), text),
  attempts: z.array(attempt).min(1), final: attempt, limitations: text });
export type Workflow = z.infer<typeof workflowSchema>;
export function time(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}
