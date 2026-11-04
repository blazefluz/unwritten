import { z } from "zod";
import { isLocalRequest } from "@/lib/local-request";
import { runPython } from "@/lib/python";
import { CATALOG, proposalSchema, sceneSchema } from "@/lib/studio/scene";
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
    if (raw.length > 100_000)
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
    return Response.json(proposalSchema.parse(output));
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
