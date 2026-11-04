import { z } from "zod";
const n = z.number().finite().min(-50).max(50);
export const vectorSchema = z.tuple([n, n, n]);
const positive = z.number().finite().min(0.005).max(30);
const profile = z
  .array(z.tuple([n, n]))
  .min(3)
  .max(128);
export const geometrySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("box"),
    size: z.tuple([positive, positive, positive]),
  }),
  z.object({
    type: z.literal("cylinder"),
    radiusTop: z.number().finite().min(0).max(15),
    radiusBottom: positive,
    length: positive,
    segments: z.number().int().min(8).max(64),
  }),
  z.object({ type: z.literal("sphere"), radius: positive }),
  z.object({ type: z.literal("torus"), radius: positive, tube: positive }),
  z.object({ type: z.literal("extrude"), profile, depth: positive }),
  z.object({ type: z.literal("lathe"), profile }),
  z.object({
    type: z.literal("mesh"),
    vertices: z.array(vectorSchema).min(3).max(1200),
    triangles: z
      .array(
        z.tuple([
          z.number().int().nonnegative(),
          z.number().int().nonnegative(),
          z.number().int().nonnegative(),
        ]),
      )
      .min(1)
      .max(2400),
  }),
]);
export const generatedPartSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),
    name: z.string().min(1).max(80),
    purpose: z.string().min(1).max(400),
    geometry: geometrySchema,
    position: vectorSchema,
    rotation: z.tuple([
      z.number().finite().min(-360).max(360),
      z.number().finite().min(-360).max(360),
      z.number().finite().min(-360).max(360),
    ]),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    material: z.enum(["metal", "plastic", "rubber", "glass", "copper"]),
    group: z.enum(["body", "motor", "battery", "cooling", "chassis", "custom"]),
    massKg: z.number().finite().min(0).max(1000),
  })
  .superRefine((part, ctx) => {
    const g = part.geometry;
    if (g.type === "cylinder" && g.radiusTop === 0 && g.radiusBottom === 0)
      ctx.addIssue({
        code: "custom",
        message: "Cylinder radii cannot both be zero.",
      });
    if (
      g.type === "lathe" &&
      (g.profile.some((p) => p[0] < 0) || g.profile.every((p) => p[0] === 0))
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Lathe radii must be nonnegative with at least one positive radius.",
      });
    if (g.type === "extrude") {
      const area = g.profile.reduce((sum, p, i) => {
        const next = g.profile[(i + 1) % g.profile.length];
        return sum + p[0] * next[1] - next[0] * p[1];
      }, 0);
      if (Math.abs(area) < 1e-8)
        ctx.addIssue({
          code: "custom",
          message: "Extrusion profile must enclose an area.",
        });
    }
    if (g.type === "mesh")
      for (const face of g.triangles) {
        if (
          face.some((index) => index >= g.vertices.length) ||
          new Set(face).size !== 3
        ) {
          ctx.addIssue({
            code: "custom",
            message: "A mesh face has invalid vertex indices.",
          });
          break;
        }
        const [a, b, c] = face.map((i) => g.vertices[i]);
        const u = b.map((v, i) => v - a[i]),
          v = c.map((x, i) => x - a[i]);
        if (
          Math.hypot(
            u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0],
          ) < 1e-10
        ) {
          ctx.addIssue({
            code: "custom",
            message: "Mesh contains a zero-area triangle.",
          });
          break;
        }
      }
  });
export const generatedPartsSchema = z
  .array(generatedPartSchema)
  .max(48)
  .superRefine((parts, ctx) => {
    if (new Set(parts.map((p) => p.id)).size !== parts.length)
      ctx.addIssue({
        code: "custom",
        message: "Generated part IDs must be unique.",
      });
  });
export type GeneratedPart = z.infer<typeof generatedPartSchema>;
