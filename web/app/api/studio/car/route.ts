import { z } from "zod";
import { isLocalRequest } from "@/lib/local-request";
import { runPython } from "@/lib/python";
import {
  CAR_PRESETS,
  carConfigSchema,
} from "@/lib/studio/car";
import { carResponseSchema } from "@/lib/studio/car-ai-schema";
import { analyzeEV } from "@/lib/studio/ev";
import { normalizeCarProposal } from "@/lib/studio/car-proposal";
import { checkCreationResult } from "@/lib/studio/creation-check";
import { generatedPartBounds } from "@/lib/studio/part-model";
export const runtime = "nodejs";
export const maxDuration = 300;
const inputSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  car: carConfigSchema.nullable(),
  selectedPart: z.string().max(80).nullable().optional(),
  worldSummary: z
    .array(
      z.object({
        name: z.string().max(80),
        style: z.string().max(20).nullable(),
        partCount: z.number().int().min(0).max(48),
      }),
    )
    .max(24)
    .optional(),
});
function validate(value: unknown, input: z.infer<typeof inputSchema>) {
  const proposal = normalizeCarProposal(value, input.car);
  checkCreationResult(
    input.car,
    proposal.car,
    input.prompt,
    proposal.newBays.map((b) => b.car),
  );
  if ((input.worldSummary?.length || 0) + proposal.newBays.length > 24)
    throw new Error("World would exceed the 24-bay limit.");
  for (const part of [
    proposal.car,
    ...proposal.newBays.map((b) => b.car),
  ].flatMap((c) => c?.parts || [])) {
    const bounds = generatedPartBounds(part);
    if (
      [...bounds.min.toArray(), ...bounds.max.toArray()].some(
        (n) => !Number.isFinite(n),
      )
    )
      throw new Error("Generated geometry has invalid bounds.");
  }
  return proposal;
}
export async function POST(request: Request) {
  if (!isLocalRequest(request))
    return Response.json(
      { error: "Open the local studio to use Meta editing." },
      { status: 403 },
    );
  if (!process.env.MODEL_API_KEY)
    return Response.json(
      {
        error:
          "Set MODEL_API_KEY in web/.env.local and restart. Local controls remain available.",
      },
      { status: 503 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 2_000_000)
      return Response.json(
        {
          error:
            "Design request exceeds 2 MB. Export this world and start a smaller design.",
        },
        { status: 413 },
      );
    const input = inputSchema.parse(JSON.parse(raw));
    const payload = {
      operation: "studio_car",
      ...input,
      presets: CAR_PRESETS,
      responseSchema: carResponseSchema(),
      analysis: input.car ? analyzeEV(input.car) : null,
    };
    const attempts: { attempt: number; failures: string[] }[] = [];
    let previous: unknown;
    let feedback: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const result = await runPython({ ...payload,
        ...(attempt > 1 ? { previousProposal: previous, validationFeedback: feedback } : {}),
      });
      try {
        const proposal = validate(result, input);
        const designs = [
          ...(proposal.car ? [{ name: "Current bay", car: proposal.car }] : []),
          ...proposal.newBays,
        ];
        const failures = designs.flatMap(({ name, car }) =>
          (car ? analyzeEV(car).checks : []).filter(c => !c.ok)
            .map(c => `${name}: ${c.label}: ${c.detail}`));
        attempts.push({ attempt, failures });
        if (failures.length && attempt < 3) {
          previous = result; feedback = failures; continue;
        }
        const history = attempts.map(a => `Attempt ${a.attempt}: ${a.failures.length ? a.failures.join("; ") : "all listed analytical checks pass"}`).join("\n");
        return Response.json({ ...proposal,
          message: `${proposal.message.slice(0, 600)}\n\n${history}`.slice(0, 1500),
          revised: attempt > 1, attempts,
          checksPassed: failures.length === 0,
        });
      } catch (error) {
        const failures = [error instanceof z.ZodError
          ? error.issues.slice(0, 8).map(i => `${i.path.join(".")}: ${i.message}`).join("; ")
          : String(error)];
        attempts.push({ attempt, failures });
        previous = result; feedback = failures;
        if (attempt === 3) return Response.json({
          error: "Muse could not produce a valid design after three attempts. Your saved design is unchanged.", attempts,
        }, { status: 422 });
      }
    }

  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof z.ZodError
            ? "The generated design failed geometry or dimension checks after one revision. Your design is unchanged. Try a smaller request."
            : "Meta could not finish the design. Your work is unchanged. Retry or use local tools.",
      },
      { status: error instanceof z.ZodError ? 400 : 502 },
    );
  }
}
