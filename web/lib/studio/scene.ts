import { z } from "zod";

export const ROOM = { width: 12, depth: 10 } as const;
export const kinds = [
  "table",
  "shelf",
  "chair",
  "stool",
  "plant",
  "lamp",
  "counter",
  "partition",
  "crate",
  "rug",
] as const;
export type Kind = (typeof kinds)[number];
export const CATALOG: Record<
  Kind,
  {
    name: string;
    size: [number, number, number];
    color: string;
    description: string;
  }
> = {
  table: {
    name: "Worktable",
    size: [2.4, 1.05, 1.2],
    color: "#b8885a",
    description: "A generous surface for making",
  },
  shelf: {
    name: "Shelving",
    size: [1.8, 2.1, 0.6],
    color: "#687b64",
    description: "Three shelves, open construction",
  },
  chair: {
    name: "Chair",
    size: [0.65, 1.05, 0.7],
    color: "#c56743",
    description: "A seat with a curved back",
  },
  stool: {
    name: "Stool",
    size: [0.55, 0.72, 0.55],
    color: "#b8885a",
    description: "Small footprint, extra seat",
  },
  plant: {
    name: "Plant",
    size: [0.8, 1.7, 0.8],
    color: "#567b4c",
    description: "A little life in the room",
  },
  lamp: {
    name: "Floor lamp",
    size: [0.65, 2.2, 0.65],
    color: "#e1b552",
    description: "A warm pool of light",
  },
  counter: {
    name: "Display counter",
    size: [2.2, 1.2, 0.9],
    color: "#c56743",
    description: "A place to show what you make",
  },
  partition: {
    name: "Partition",
    size: [2.4, 2.4, 0.65],
    color: "#687b64",
    description: "Give a space some structure",
  },
  crate: {
    name: "Crate",
    size: [0.8, 0.65, 0.65],
    color: "#b8885a",
    description: "Stack-free storage at floor level",
  },
  rug: {
    name: "Rug",
    size: [3.5, 0.025, 2.5],
    color: "#d8ad72",
    description: "Define a zone on the floor",
  },
};
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const vec3 = (min: number, max: number) =>
  z.tuple([
    z.number().finite().min(min).max(max),
    z.number().finite().min(min).max(max),
    z.number().finite().min(min).max(max),
  ]);
/** One primitive of a Muse-made item, in metres, relative to the item's floor centre. */
export const partSchema = z.object({
  shape: z.enum(["box", "cylinder", "sphere"]),
  /** box: width, height, depth. cylinder: diameter, height, diameter. sphere: diameter ×3. */
  size: vec3(0.01, 4),
  /** Centre of the part. y is height of the centre above the floor. */
  offset: vec3(-2.5, 3.5),
  color: hex,
});
export type Part = z.infer<typeof partSchema>;
/**
 * A store item Muse designs when the catalog has nothing like it (a fridge,
 * a produce stand, a checkout lane). `kind` is the catalog behaviour it takes
 * on in the simulation: shelf/crate/table are merchandise, counter is checkout.
 */
export const designSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),
  name: z.string().trim().min(1).max(60),
  kind: z.enum(kinds),
  size: z.tuple([
    z.number().finite().min(0.2).max(5),
    z.number().finite().min(0.02).max(3),
    z.number().finite().min(0.2).max(5),
  ]),
  parts: z.array(partSchema).min(1).max(12),
  description: z.string().trim().max(160).default(""),
});
export type Design = z.infer<typeof designSchema>;
/** Something the store sells, stocked on one fixture in the scene. */
export const productSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),
  name: z.string().trim().min(1).max(60),
  price: z.number().finite().min(0).max(100000),
  stock: z.number().int().min(0).max(999),
  fixtureId: z.string().max(60),
  color: hex,
});
export type Product = z.infer<typeof productSchema>;
export const objectSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),
  kind: z.enum(kinds),
  label: z.string().min(1).max(80),
  x: z.number().finite().min(-6).max(6),
  z: z.number().finite().min(-5).max(5),
  rotation: z.union([
    z.literal(0),
    z.literal(90),
    z.literal(180),
    z.literal(270),
  ]),
  scale: z.number().finite().min(0.5).max(2),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** Set when the object is an instance of a Muse-made design. */
  designId: z.string().max(60).optional(),
  /** Resolved from the design: unscaled size and primitives. */
  size: designSchema.shape.size.optional(),
  parts: z.array(partSchema).max(12).optional(),
});
export type SceneObject = z.infer<typeof objectSchema>;
export const sceneSchema = z
  .object({
    version: z.literal(1),
    name: z.string().min(1).max(100),
    lighting: z.enum(["day", "night"]),
    objects: z.array(objectSchema).max(40),
    designs: z.array(designSchema).max(16).optional(),
    products: z.array(productSchema).max(40).optional(),
  })
  .superRefine((scene, ctx) => {
    if (new Set(scene.objects.map((o) => o.id)).size !== scene.objects.length)
      ctx.addIssue({ code: "custom", message: "Object IDs must be unique." });
    const designs = new Set((scene.designs || []).map((d) => d.id));
    if (designs.size !== (scene.designs || []).length)
      ctx.addIssue({ code: "custom", message: "Design IDs must be unique." });
    for (const o of scene.objects)
      if (o.designId && !designs.has(o.designId))
        ctx.addIssue({
          code: "custom",
          message: `${o.label} uses a design that does not exist.`,
        });
    const products = scene.products || [];
    if (new Set(products.map((p) => p.id)).size !== products.length)
      ctx.addIssue({ code: "custom", message: "Product IDs must be unique." });
  });
export type World = z.infer<typeof sceneSchema>;
// Optional one-line rationale the avatar says aloud while it builds.
const reasonSchema = z.string().trim().max(160).optional();
export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("add"),
    object: objectSchema,
    reason: reasonSchema,
  }),
  z.object({
    type: z.literal("update"),
    object: objectSchema,
    reason: reasonSchema,
  }),
  z.object({
    type: z.literal("remove"),
    id: z.string().min(1).max(60),
    reason: reasonSchema,
  }),
  z.object({ type: z.literal("lighting"), value: z.enum(["day", "night"]) }),
]);
export const proposalSchema = z.object({
  message: z.string().min(1).max(1500),
  actions: z.array(actionSchema).max(40),
  /** New or revised Muse-made items; instances reference them by designId. */
  designs: z.array(designSchema).max(16).optional(),
  /** The complete product catalog when Muse changes it; omitted means unchanged. */
  products: z.array(productSchema).max(40).nullable().optional(),
});
export type Proposal = z.infer<typeof proposalSchema>;
/** A store Muse rebuilt from a photo, with what it says it saw. */
export const photoProposalSchema = proposalSchema.extend({
  name: z.string().trim().min(1).max(100),
  observed: z.array(z.string().trim().max(240)).max(12),
});
export type PhotoProposal = z.infer<typeof photoProposalSchema>;
export type Issue = { ids: string[]; message: string };
export function makeObject(kind: Kind, x = 0, z = 0): SceneObject {
  return {
    id: `${kind}-${crypto.randomUUID().slice(0, 8)}`,
    kind,
    label: CATALOG[kind].name,
    x,
    z,
    rotation: 0,
    scale: 1,
    color: CATALOG[kind].color,
  };
}
/** Unscaled [width, height, depth]: the design's size, or the catalog's. */
export function sizeOf(o: SceneObject): [number, number, number] {
  return o.size || CATALOG[o.kind].size;
}
export function footprint(o: SceneObject) {
  const [w, , d] = sizeOf(o);
  return {
    w: (o.rotation % 180 ? d : w) * o.scale,
    d: (o.rotation % 180 ? w : d) * o.scale,
  };
}
export function inspectScene(world: World): Issue[] {
  const issues: Issue[] = [];
  for (const [i, a] of world.objects.entries()) {
    const fa = footprint(a);
    if (
      Math.abs(a.x) + fa.w / 2 > ROOM.width / 2 + 0.001 ||
      Math.abs(a.z) + fa.d / 2 > ROOM.depth / 2 + 0.001
    )
      issues.push({
        ids: [a.id],
        message: `${a.label} extends outside the room.`,
      });
    if (a.kind === "rug") continue;
    for (const b of world.objects.slice(i + 1)) {
      if (b.kind === "rug") continue;
      const fb = footprint(b);
      if (
        Math.abs(a.x - b.x) < (fa.w + fb.w) / 2 - 0.01 &&
        Math.abs(a.z - b.z) < (fa.d + fb.d) / 2 - 0.01
      )
        issues.push({
          ids: [a.id, b.id],
          message: `${a.label} overlaps ${b.label}.`,
        });
    }
  }
  return issues;
}
/** Copy a design's size and parts onto an object that references it. */
export function resolveDesign(o: SceneObject, designs: Design[] = []) {
  if (!o.designId) {
    const { size: _size, parts: _parts, designId: _id, ...plain } = o;
    return plain;
  }
  const design = designs.find((d) => d.id === o.designId);
  if (!design) throw new Error(`${o.label} uses a design that does not exist.`);
  return { ...o, size: design.size, parts: design.parts };
}
export function applyProposal(world: World, proposal: Proposal): World {
  const next: World = structuredClone(world);
  if (proposal.designs?.length) {
    const designs = [...(next.designs || [])];
    for (const d of proposal.designs) {
      const i = designs.findIndex((x) => x.id === d.id);
      if (i < 0) designs.push(d);
      else designs[i] = d;
    }
    next.designs = designs;
  }
  for (const action of proposal.actions) {
    if (action.type === "lighting") next.lighting = action.value;
    else if (action.type === "remove") {
      if (!next.objects.some((o) => o.id === action.id))
        throw new Error("The object to remove no longer exists.");
      next.objects = next.objects.filter((o) => o.id !== action.id);
    } else if (action.type === "add") {
      if (next.objects.some((o) => o.id === action.object.id))
        throw new Error("That object ID already exists.");
      next.objects.push(action.object);
    } else {
      const index = next.objects.findIndex((o) => o.id === action.object.id);
      if (index < 0) throw new Error("The object to update no longer exists.");
      next.objects[index] = action.object;
    }
  }
  next.objects = next.objects.map((o) => resolveDesign(o, next.designs));
  if (proposal.products) next.products = proposal.products;
  // Products on a fixture that no longer exists have nowhere to be sold.
  if (next.products)
    next.products = next.products.filter((p) =>
      next.objects.some((o) => o.id === p.fixtureId),
    );
  return sceneSchema.parse(next);
}
export function findSpace(
  world: World,
  object: SceneObject,
): SceneObject | null {
  const candidates: { x: number; z: number; distance: number }[] = [];
  for (let x = -5.5; x <= 5.5; x += 0.5)
    for (let z = -4.5; z <= 4.5; z += 0.5)
      candidates.push({
        x,
        z,
        distance: (x - object.x) ** 2 + (z - object.z) ** 2,
      });
  for (const p of candidates.sort((a, b) => a.distance - b.distance)) {
    const candidate = { ...object, x: p.x, z: p.z };
    const test = {
      ...world,
      objects: [...world.objects.filter((o) => o.id !== object.id), candidate],
    };
    if (!inspectScene(test).some((issue) => issue.ids.includes(object.id)))
      return candidate;
  }
  return null;
}
export function repairPlacement(world: World, movable: string[]): World | null {
  const next = structuredClone(world);
  for (const id of movable) {
    const object = next.objects.find((o) => o.id === id);
    if (!object || !inspectScene(next).some((issue) => issue.ids.includes(id)))
      continue;
    const placed = findSpace(next, object);
    if (!placed) return null;
    next.objects[next.objects.findIndex((o) => o.id === id)] = placed;
  }
  return inspectScene(next).length ? null : next;
}
export const EMPTY_WORLD: World = {
  version: 1,
  name: "Untitled space",
  lighting: "day",
  objects: [],
};
// Scripted narration for the built-in example. Shown only for that example,
// which the studio labels as scripted rather than AI output.
export const MARKET_REASONS: Record<string, string> = {
  "Display counter": "Counter near the entrance so visitors see work first.",
  "Making table": "Making table in the open, where people can watch.",
  "Stock shelving": "Stock against the back wall, out of the walkway.",
  "Material shelving": "Materials beside the table, one step from the work.",
  "Maker’s chair": "Chair facing the table and the visitors.",
  "Corner plant": "A plant softens the empty back corner.",
  "Task light": "Light over the making table for close work.",
  "Storage crate": "Crate tucked behind the counter for spare stock.",
  "Work zone": "Rug marks the making zone so visitors know where to stand.",
  "Visitor stool": "A stool at the counter invites people to stay.",
};
export function marketWorld(): World {
  const specifications: [Kind, number, number, string, number?][] = [
    ["counter", -2.6, 0, "Display counter"],
    ["table", 1.2, -1.7, "Making table"],
    ["shelf", -3.5, -3.65, "Stock shelving"],
    ["shelf", 0, -3.65, "Material shelving"],
    ["chair", 1.2, -0.5, "Maker’s chair", 180],
    ["plant", 4.2, -3.5, "Corner plant"],
    ["lamp", 3.7, -1.8, "Task light"],
    ["crate", -4.5, 1.9, "Storage crate"],
    ["rug", 0.5, 0.9, "Work zone"],
    ["stool", -2.7, 1.25, "Visitor stool"],
  ];
  return {
    version: 1,
    name: "The maker’s market",
    lighting: "day",
    objects: specifications.map(([kind, x, z, label, rotation]) => ({
      ...makeObject(kind, x, z),
      label,
      rotation: (rotation || 0) as SceneObject["rotation"],
    })),
  };
}

// Deliberately limited, transparent local command interpreter; never represented as AI.
export function localCommand(
  world: World,
  text: string,
  selectedId: string | null,
): Proposal {
  const q = text.trim().toLowerCase();
  if (/\b(night|nighttime|evening|dark)\b/.test(q))
    return {
      message: "Night lighting is on. This edit used local controls, not AI.",
      actions: [{ type: "lighting", value: "night" }],
    };
  if (/\b(day|daytime|daylight|morning)\b/.test(q))
    return {
      message: "Daylight is back. This edit used local controls, not AI.",
      actions: [{ type: "lighting", value: "day" }],
    };
  const selected = world.objects.find((o) => o.id === selectedId);
  if (/\b(build|create)\b.*\b(market|workshop|studio)\b/.test(q)) {
    if (world.objects.length)
      throw new Error(
        "Start an empty scene first, or add individual objects. Your current space is preserved.",
      );
    return {
      message:
        "Loaded the built-in maker’s market template. This is a scripted example, not AI output.",
      actions: marketWorld().objects.map((object) => ({
        type: "add" as const,
        object,
        reason: MARKET_REASONS[object.label],
      })),
    };
  }
  if (/\b(add|place|put)\b/.test(q)) {
    const kind = kinds.find(
      (k) =>
        q.includes(k) ||
        (k === "shelf" && /shelv/.test(q)) ||
        (k === "table" && /bench/.test(q)) ||
        (k === "lamp" && /light/.test(q)),
    );
    if (!kind)
      throw new Error(
        "Local mode can add a table, shelf, chair, stool, plant, lamp, counter, partition, crate or rug.",
      );
    const base = makeObject(
      kind,
      selected ? selected.x : 0,
      selected ? selected.z : 0,
    );
    const object =
      selected && /\b(here|this|same)\b/.test(q)
        ? base
        : findSpace(world, base);
    if (!object)
      throw new Error(
        "No clear floor space was found. Remove or shrink an object first.",
      );
    return {
      message: `Added ${CATALOG[kind].name.toLowerCase()} using the local catalog.`,
      actions: [{ type: "add", object }],
    };
  }
  if (!selected)
    throw new Error(
      "Select an object first. Local mode supports add, move left/right/back/forward, rotate, resize, colors and day/night.",
    );
  if (/\b(delete|remove)\b/.test(q))
    return {
      message: `Removed ${selected.label}.`,
      actions: [{ type: "remove", id: selected.id }],
    };
  let object = { ...selected };
  const number = q.match(/\b(\d+(?:\.\d+)?)\s*(?:m|met(?:er|re)s?)?\b/);
  const amount = number ? Math.min(5, Number(number[1])) : 0.5;
  if (/\b(move|shift)\b/.test(q)) {
    if (/\bleft\b/.test(q)) object.x -= amount;
    else if (/\bright\b/.test(q)) object.x += amount;
    else if (/\b(back|away)\b/.test(q)) object.z -= amount;
    else if (/\b(forward|front|closer)\b/.test(q)) object.z += amount;
    else
      throw new Error(
        "In local mode, specify left, right, forward or back. Directions follow the room axes.",
      );
  } else if (/\brotat|\bturn\b/.test(q))
    object.rotation = ((object.rotation + 90) % 360) as SceneObject["rotation"];
  else if (/\b(smaller|shrink)\b/.test(q))
    object.scale = Math.max(0.5, object.scale - 0.25);
  else if (/\b(bigger|larger|grow)\b/.test(q))
    object.scale = Math.min(2, object.scale + 0.25);
  else {
    const colors: Record<string, string> = {
      orange: "#c56743",
      green: "#687b64",
      blue: "#5d7d99",
      yellow: "#e1b552",
      white: "#e8e6e1",
      black: "#343737",
      pink: "#ce8d9c",
    };
    const color = Object.keys(colors).find((c) => q.includes(c));
    if (!color)
      throw new Error(
        "That request needs Meta AI. Local mode supports add, move, rotate, resize, colors and day/night.",
      );
    object.color = colors[color];
  }
  object = objectSchema.parse(object);
  return {
    message: `Updated ${object.label} using local controls.`,
    actions: [{ type: "update", object }],
  };
}

const clamp = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(min, v))
    : v;
const clamp3 = (v: unknown, min: number, max: number) =>
  Array.isArray(v) ? v.map((n) => clamp(n, min, max)) : v;
/**
 * Bring a model proposal's design and product numbers into range before
 * validation, so a fridge 3.02 m tall is clamped rather than rejecting the
 * whole store. Structure, ids and references are still validated strictly.
 */
export function normalizeProposal(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const out = structuredClone(raw) as Record<string, unknown>;
  if (Array.isArray(out.actions))
    for (const a of out.actions as Record<string, unknown>[]) {
      const o = a?.object as Record<string, unknown> | undefined;
      if (!o) continue;
      if (o.designId === null || o.designId === "") delete o.designId;
      o.x = clamp(o.x, -6, 6);
      o.z = clamp(o.z, -5, 5);
      o.scale = clamp(o.scale, 0.5, 2);
    }
  if (Array.isArray(out.designs))
    out.designs = (out.designs as Record<string, unknown>[]).map((d) => {
      const size = d.size as number[] | undefined;
      return {
        ...d,
        size: Array.isArray(size)
          ? [
              clamp(size[0], 0.2, 5),
              clamp(size[1], 0.02, 3),
              clamp(size[2], 0.2, 5),
            ]
          : size,
        parts: Array.isArray(d.parts)
          ? (d.parts as Record<string, unknown>[]).slice(0, 12).map((part) => ({
              ...part,
              size: clamp3(part.size, 0.01, 4),
              offset: clamp3(part.offset, -2.5, 3.5),
            }))
          : d.parts,
      };
    });
  if (Array.isArray(out.products))
    out.products = (out.products as Record<string, unknown>[])
      .slice(0, 40)
      .map((p) => ({
        ...p,
        price: clamp(p.price, 0, 100000),
        stock:
          typeof p.stock === "number"
            ? Math.round(clamp(p.stock, 0, 999) as number)
            : p.stock,
      }));
  return out;
}
