import { z } from "zod";
import { isLocalRequest } from "@/lib/local-request";
import { runPython } from "@/lib/python";
import {
  CATALOG,
  normalizeProposal,
  proposalSchema,
  sceneSchema,
} from "@/lib/studio/scene";
export const runtime = "nodejs";
export const maxDuration = 240;
export const dynamic = "force-dynamic";
const inputSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  scene: sceneSchema,
  selectedId: z.string().max(60).nullable(),
});
export async function GET(request: Request) {
  return Response.json(
    {
      ready: isLocalRequest(request) && Boolean(process.env.MODEL_API_KEY),
      model: "muse-spark-1.3",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (!isLocalRequest(request))
    return Response.json(
      { error: "Meta editing is available from the local studio only." },
      { status: 403 },
    );
  if (!process.env.MODEL_API_KEY)
    return Response.json(
      {
        error:
          "Set MODEL_API_KEY in web/.env.local and restart the server. Local editing is available now.",
      },
      { status: 503 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 400_000)
      return Response.json(
        { error: "This scene request is too large." },
        { status: 413 },
      );
    const input = inputSchema.parse(JSON.parse(raw));
    if (
      input.selectedId &&
      !input.scene.objects.some((o) => o.id === input.selectedId)
    )
      return Response.json(
        { error: "The selected object no longer exists. Select it again." },
        { status: 400 },
      );
    const output = await runPython({
      operation: "studio",
      ...input,
      catalog: CATALOG,
    });
    const failure = z.object({ bridge_error: z.string() }).safeParse(output);
    if (failure.success) {
      const messages: Record<string, [number, string]> = {
        authentication: [
          502,
          "Meta rejected the API credentials or project access. Check MODEL_API_KEY and Meta project permissions, then restart the server. Your layout is unchanged.",
        ],
        rate_limit: [
          429,
          "Meta is rate-limiting requests or the project has reached its usage limit. Check Meta usage and billing, then retry. Your layout is unchanged.",
        ],
        timeout: [
          504,
          "Muse took too long to finish this layout. Retry once, or ask it to move fewer objects. Your layout is unchanged.",
        ],
        invalid_response: [
          502,
          "Muse did not return a complete layout proposal. Retry with fewer objects or a smaller change. Your layout is unchanged.",
        ],
        provider_unavailable: [
          503,
          "Meta is temporarily unavailable. Retry shortly. Your layout is unchanged.",
        ],
        request_failed: [
          502,
          "The Meta request failed before a usable proposal was returned. Check the server connection and Meta project access. Your layout is unchanged.",
        ],
      };
      const [status, error] =
        messages[failure.data.bridge_error] || messages.request_failed;
      return Response.json({ error }, { status });
    }
    return Response.json(proposalSchema.parse(normalizeProposal(output)));
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        {
          error:
            "The scene or proposed edit was invalid. Your space is unchanged; try a simpler request.",
        },
        { status: 400 },
      );
    return Response.json(
      {
        error:
          "Meta could not finish this edit. Your space is unchanged. Check API access and retry, or switch to Local mode.",
      },
      { status: 502 },
    );
  }
}
