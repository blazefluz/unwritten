import type { CarConfig } from "./car";
/** A completion claim cannot substitute for returning requested new geometry. */
export function checkCreationResult(
  before: CarConfig | null,
  after: CarConfig | null,
  prompt: string,
  extraCars: (CarConfig | null)[] = [],
) {
  const requested = prompt.replace(/\b(?:do not|don’t|don't|never)\s+(?:create|build|design|add|generate)\b[^.!?]*/gi, "");
  const creation =
    /\b(create|build|design|add|generate)\b/i.test(requested) &&
    /\b(parts?|ducts?|housings?|brackets?|meshes|mesh|assembly|panels?|vanes?|casings?)\b/i.test(
      requested,
    );
  if (!creation) return;
  const existing = new Set(before?.parts.map((p) => p.id) || []);
  if (
    ![after, ...extraCars].some((c) =>
      c?.parts.some((p) => !existing.has(p.id)),
    )
  )
    throw new Error(
      "New part geometry was requested, but no new geometry was returned. Populate car.parts with actual geometry definitions; a message claiming completion is insufficient.",
    );
}
