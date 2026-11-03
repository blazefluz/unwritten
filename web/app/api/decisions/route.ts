import { isLocalRequest } from "@/lib/local-request";
import { z } from "zod";
import { observationSchema, decisionSchema } from "@/lib/decisions";
import { runPython } from "@/lib/python";
export const runtime = "nodejs";
export const maxDuration = 900;
const inputSchema = z.object({observation: observationSchema,
  labels: z.record(z.string(), z.string().trim().min(1).max(100)),
  train_fraction: z.number().min(0.2).max(0.8)});
export async function POST(request: Request) {
  if (!isLocalRequest(request))
    return Response.json({error: "Open the local app to run a test."}, {status: 403});
  if (!process.env.MODEL_API_KEY)
    return Response.json({error: "Meta API setup is needed. Your annotations can be saved offline."}, {status: 503});
  try {
    const raw = await request.text();
    if (raw.length > 2_000_000) return Response.json({error: "Test input is too large."}, {status: 413});
    const input = inputSchema.parse(JSON.parse(raw));
    if (input.observation.events.length < 3 || input.observation.events.length > 50)
      return Response.json({error: "Use 3–50 labelled events for a bounded test."}, {status: 400});
    return Response.json(decisionSchema.parse(await runPython({operation: "decisions", ...input})));
  } catch {
    return Response.json({error: "Test could not finish. Check labels, non-overlapping event times, and Meta API access. Your annotations remain in this page."}, {status: 400});
  }
}
