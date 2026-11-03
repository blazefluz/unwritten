import { z } from "zod";
const text=z.string().max(8000);
const value=z.union([z.number().finite(),z.string().max(1000),z.boolean(),z.null()]);
export const ruleSchema=z.object({id:text.min(1),title:text.min(1),reason:text,
  evidence_case_ids:z.array(text),steps:z.array(z.object({if_all:z.array(z.object({
    feature:text,op:z.enum(["eq","ne","gt","gte","lt","lte"]),value,
    other_feature:text.nullable(),absolute:z.boolean()})).min(1).max(8),then:text})).min(1).max(12),otherwise:text.nullable()});
export type GuideRule=z.infer<typeof ruleSchema>;
export const projectSchema=z.object({version:z.literal(1),title:text,task:text,scope:text,
  outcomes:z.array(z.string().max(100)).max(12),
  features:z.array(z.object({key:z.string().max(100),label:z.string().max(200),type:z.enum(["number","text","boolean"])})).max(20),
  cases:z.array(z.object({id:z.string().min(1).max(100),summary:text,source:text,
    time_start:z.number().finite().nonnegative().nullable(),features:z.record(z.string(),value),
    split:z.enum(["train","question","test"]),outcome:z.string().max(100).nullable(),
    label_source:text,expert_reason:text})).max(100),baseline_rule:ruleSchema.nullable()});
export type TrainingProject=z.infer<typeof projectSchema>;
export const studySchema=z.object({kind:z.literal("training_study"),dataset_fingerprint:z.string().regex(/^[a-f0-9]{64}$/),
  created_at:text,candidates:z.array(ruleSchema).max(6),provenance:text,
  initial_candidates:z.array(ruleSchema).optional(), revision_history:z.array(z.object({revised_at:text,candidates:z.array(ruleSchema),inspection:z.unknown()})).optional(),
  direct_predictions:z.array(z.object({case_id:text,outcome:text.nullable(),reason:text}))});
export type TrainingStudy=z.infer<typeof studySchema>;
export type Inspection={active_rule_ids:string[];statuses:{id:string;consistent:boolean;counterexample_ids:string[]}[];
  questions:{case_id:string;score:number;selection_reason?:"disagreement"|"coverage_probe";predictions:{rule_id:string;outcome:string|null}[];question:string}[];answered_questions:number};
export type FrozenGuide={kind:"frozen_training_guide";id:string;frozen_at:string;fingerprint:string;
  project:TrainingProject;study:TrainingStudy;analysis:Inspection;selected_rule:GuideRule;
  reviewer:string;review_note:string;approval_type:"demo"|"expert_attestation";approval_notice:string;
  predictions:{case_id:string;prediction:string|null;consensus_before:string|null;consensus_after:string|null;direct_meta:string|null;majority:string;declared_baseline:string|null}[];
  consistent_before:number;consistent_after:number};
export type TrainingValidation={kind:"training_validation";guide_id:string;guide_fingerprint:string;
  scores:Record<string,{correct:number;total:number;abstained:number;answered:number}>;
  cases:(FrozenGuide["predictions"][number]&{actual:string;label_source:string})[];
  consistent_before:number;consistent_after:number;questions_answered:number;limitations:string};
export function ruleText(rule:GuideRule,project:TrainingProject) {
  const labels=Object.fromEntries(project.features.map(f=>[f.key,f.label]));
  const ops={eq:"equals",ne:"does not equal",gt:"is greater than",gte:"is at least",lt:"is less than",lte:"is at most"};
  return rule.steps.map(step=>`If ${step.if_all.map(c=>{
    let left=labels[c.feature]||c.feature;
    let right=c.other_feature?(labels[c.other_feature]||c.other_feature):String(c.value);
    if(c.absolute){left=`magnitude of ${left}`;right=`magnitude of ${right}`;}
    return `${left} ${ops[c.op]} ${right}`;
  }).join(" and ")}, choose ${step.then}.`).join(" ")+` Otherwise ${rule.otherwise||"ask the expert"}.`;
}
export function emptyProject():TrainingProject {return {version:1,title:"",task:"",scope:"",outcomes:["accept","repair","reject"],
  features:[],cases:[],baseline_rule:null};}
export const inspectionSchema=z.object({active_rule_ids:z.array(text),statuses:z.array(z.object({id:text,consistent:z.boolean(),counterexample_ids:z.array(text)})),
  questions:z.array(z.object({case_id:text,score:z.number().finite(),selection_reason:z.enum(["disagreement","coverage_probe"]).optional(),predictions:z.array(z.object({rule_id:text,outcome:text.nullable()})),question:text})),answered_questions:z.number().int().nonnegative()});
const predictionRow=z.object({case_id:text,prediction:text.nullable(),consensus_before:text.nullable(),consensus_after:text.nullable(),direct_meta:text.nullable(),majority:text,declared_baseline:text.nullable()});
export const frozenSchema=z.object({kind:z.literal("frozen_training_guide"),id:z.string().uuid(),frozen_at:text,fingerprint:text,
  project:projectSchema,study:studySchema,analysis:inspectionSchema,selected_rule:ruleSchema,
  reviewer:text,review_note:text,approval_type:z.enum(["demo","expert_attestation"]),approval_notice:text,
  predictions:z.array(predictionRow),consistent_before:z.number().int(),consistent_after:z.number().int()});
export const validationSchema=z.object({kind:z.literal("training_validation"),guide_id:text,guide_fingerprint:text,
  scores:z.record(z.string(),z.object({correct:z.number().int().nonnegative(),total:z.number().int().positive(),abstained:z.number().int().nonnegative(),answered:z.number().int().nonnegative()})),
  cases:z.array(predictionRow.extend({actual:text,label_source:text})),consistent_before:z.number().int(),consistent_after:z.number().int(),questions_answered:z.number().int(),limitations:text});
export const sessionSchema=z.object({project:projectSchema,study:studySchema.nullable().default(null),
  inspection:inspectionSchema.nullable().default(null),frozen:frozenSchema.nullable().default(null),
  markdown:z.string().max(180000).default(""),validation:validationSchema.nullable().default(null),
  business:z.object({before_minutes:z.number().nonnegative().nullable(),after_minutes:z.number().nonnegative().nullable(),notes:text}).default({before_minutes:null,after_minutes:null,notes:""})});
export type TrainingSession=z.infer<typeof sessionSchema>;
export function newSession(project=emptyProject()):TrainingSession {return {project,study:null,inspection:null,frozen:null,markdown:"",validation:null,business:{before_minutes:null,after_minutes:null,notes:""}};}
