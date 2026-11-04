import { z } from "zod";
import { isLocalRequest } from "@/lib/local-request";
import { runPython } from "@/lib/python";
import {
  CATALOG,
  normalizeProposal,
  photoProposalSchema,
} from "@/lib/studio/scene";
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// The browser downsizes photos to at most 1280 px JPEG before sending.
const MAX_IMAGE_CHARS = 4_000_000;
const inputSchema = z.object({
  image: z
    .string()
    .max(MAX_IMAGE_CHARS)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
  note: z.string().trim().max(500).default(""),
});

const FAILURES: Record<string, [number, string]> = {
  authentication: [
    502,
    "Meta rejected the API credentials or project access. Check MODEL_API_KEY, then restart the server.",
  ],
  rate_limit: [
    429,
    "Meta is rate-limiting requests or the project reached its usage limit. Retry shortly.",
  ],
  timeout: [
    504,
    "Muse took too long to read this photo. Retry, or try a smaller or simpler photo.",
  ],
  invalid_response: [
    502,
    "Muse did not return a complete store. Retry; a clearer photo of the shop interior helps.",
  ],
  provider_unavailable: [
    503,
    "Meta is temporarily unavailable. Retry shortly.",
  ],
  request_failed: [
    502,
    "The Meta request failed before a store was returned. Check the server connection and Meta access.",
  ],
};

export async function POST(request: Request) {
  if (!isLocalRequest(request))
    return Response.json(
      {
        error: "Building from a photo is available from the local studio only.",
      },
      { status: 403 },
    );
  if (!process.env.MODEL_API_KEY)
    return Response.json(
      {
        error:
          "Building from a photo needs Meta AI. Set MODEL_API_KEY in web/.env.local and restart the server.",
      },
      { status: 503 },
    );
  try {
    const raw = await request.text();
    if (raw.length > MAX_IMAGE_CHARS + 2000)
      return Response.json(
        { error: "This photo is too large. Try a smaller one." },
        { status: 413 },
      );
    const input = inputSchema.parse(JSON.parse(raw));
    const output = await runPython({
      operation: "studio_photo",
      ...input,
      catalog: CATALOG,
    });
    const failure = z.object({ bridge_error: z.string() }).safeParse(output);
    if (failure.success) {
      const [status, error] =
        FAILURES[failure.data.bridge_error] || FAILURES.request_failed;
      return Response.json({ error }, { status });
    }
    return Response.json(photoProposalSchema.parse(normalizeProposal(output)));
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        {
          error:
            "Muse's store did not pass validation. Nothing was changed; retry with the same photo.",
        },
        { status: 400 },
      );
    return Response.json(
      {
        error: "Meta could not finish reading this photo. Nothing was changed.",
      },
      { status: 502 },
    );
  }
}
