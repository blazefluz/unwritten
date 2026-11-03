import { z } from "zod";
import { workflowSchema } from "@/lib/workflow";
import { runPython } from "@/lib/python";
export const runtime = "nodejs";
export const maxDuration = 900;
const schema = z.object({workflow: workflowSchema, answers: z.record(z.string().max(8000), z.string().max(8000))});
export async function POST(request: Request) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({error: "Open the local app to review answers."}, {status: 403});
  if (!process.env.MODEL_API_KEY)
    return Response.json({error: "Meta API setup is needed. Save your answers for now."}, {status: 503});
  try {
    const raw = await request.text();
    if (raw.length > 2_000_000) return Response.json({error: "Review input is too large."}, {status: 413});
    const input = schema.parse(JSON.parse(raw));
    if (!Object.values(input.answers).some(v => v.trim()))
      return Response.json({error: "Add an expert answer first."}, {status: 400});
    return Response.json(workflowSchema.parse(await runPython({operation: "review", ...input})));
  } catch {
    return Response.json({error: "Review could not finish. Your answers and previous assessments are preserved. Check Meta API access and reference inputs."}, {status: 400});
  }
}
