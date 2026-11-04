import { z } from "zod";
import { carProposalSchema } from "./car";
/** Inline, non-recursive JSON Schema for Meta's structured Responses API. */
export function carResponseSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(carProposalSchema, {
    reused: "inline",
    cycles: "throw",
  });
  function normalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(normalize);
    if (!value || typeof value !== "object") return value;
    const source = value as Record<string, unknown>,
      result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(source)) {
      if (["$schema", "default"].includes(key)) continue;
      if (key === "items" && "prefixItems" in source) continue;
      if (key === "prefixItems") {
        const items = entry as unknown[];
        result.items = normalize(items[0]);
        result.minItems = items.length;
        result.maxItems = items.length;
      } else result[key === "oneOf" ? "anyOf" : key] = normalize(entry);
    }
    return result;
  }
  return normalize(schema) as Record<string, unknown>;
}
