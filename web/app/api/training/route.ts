import { z } from "zod";
import { projectSchema, studySchema } from "@/lib/training";
import { runPython } from "@/lib/python";
export const runtime="nodejs";
export const maxDuration=900;
const schema=z.object({action:z.enum(["propose","inspect","freeze","validate"]),project:projectSchema,
  study:studySchema.optional(),rule_id:z.string().max(100).optional(),reviewer:z.string().max(1000).optional(),
  review_note:z.string().max(8000).optional(),approval_type:z.enum(["demo","expert_attestation"]).optional(),freeze_id:z.string().uuid().optional()});
export async function POST(request:Request) {
  if(request.headers.get("origin")&&request.headers.get("origin")!==new URL(request.url).origin)
    return Response.json({error:"Open the local app to work on a guide."},{status:403});
  try {
    const raw=await request.text();if(raw.length>2_000_000)return Response.json({error:"Guide input is too large."},{status:413});
    const input=schema.parse(JSON.parse(raw));
    if(input.action==="propose"&&!process.env.MODEL_API_KEY)
      return Response.json({error:"Meta API setup is needed to propose rules. Case preparation, saved-rule review and validation work offline."},{status:503});
    const output=await runPython({operation:"training",...input}) as Record<string,unknown>;
    return Response.json(output,{status:output.error?400:200});
  } catch {return Response.json({error:"The guide operation could not finish. Check the case fields and local Python environment; Meta access is required only to propose rules."},{status:400});}
}
