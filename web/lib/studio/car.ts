import { z } from "zod";
import { DEFAULT_EV, evSchema } from "./ev";
import { generatedPartsSchema } from "./generated-parts";
export const carConfigSchema = z
  .object({
    shellMode: z.enum(["preset", "generated"]).default("preset"),
    ev: evSchema.default(DEFAULT_EV),
    parts: generatedPartsSchema.default([]),
    style: z.enum(["coupe", "sedan", "suv"]),
    length: z.number().finite().min(3).max(6),
    width: z.number().finite().min(1.5).max(2.5),
    height: z.number().finite().min(1.1).max(2.2),
    wheelbase: z.number().finite().min(1.9).max(4.2),
    wheelRadius: z.number().finite().min(0.25).max(0.48),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    roofColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    spoiler: z.boolean(),
  })
  .superRefine((car, ctx) => {
    if (car.wheelbase + car.wheelRadius * 2 > car.length - 0.1)
      ctx.addIssue({
        code: "custom",
        message:
          "The wheelbase and tyres must fit inside the body length. Increase length or reduce wheelbase / wheel radius.",
      });
    if (car.wheelRadius * 2 + 0.15 > car.height)
      ctx.addIssue({
        code: "custom",
        message:
          "The wheel diameter leaves too little room for the body. Increase height or reduce wheel radius.",
      });
  });
export type CarConfig = z.infer<typeof carConfigSchema>;
export const carDocumentSchema = z
  .object({
    version: z.literal(1),
    type: z.literal("car"),
    name: z.string().trim().min(1).max(100),
    car: carConfigSchema.nullable(),
    bays: z
      .array(
        z.object({
          id: z.string().regex(/^[a-zA-Z0-9_-]{1,60}$/),
          name: z.string().min(1).max(80),
          x: z.number().finite().min(-500).max(500),
          z: z.number().finite().min(-500).max(500),
          car: carConfigSchema.nullable(),
        }),
      )
      .max(24)
      .default([]),
    activeBayId: z.string().max(60).nullable().default(null),
  })
  .superRefine((doc, ctx) => {
    if (new Set(doc.bays.map((b) => b.id)).size !== doc.bays.length)
      ctx.addIssue({
        code: "custom",
        message: "Design bay IDs must be unique.",
      });
    if (doc.bays.length && !doc.bays.some((b) => b.id === doc.activeBayId))
      ctx.addIssue({
        code: "custom",
        message: "Active design bay is missing.",
      });
    const active = doc.bays.find((b) => b.id === doc.activeBayId);
    if (active && JSON.stringify(active.car) !== JSON.stringify(doc.car))
      ctx.addIssue({
        code: "custom",
        message: "Active design does not match its bay.",
      });
  });
export type CarDocument = z.infer<typeof carDocumentSchema>;
export const carProposalSchema = z.object({
  message: z.string().min(1).max(1500),
  newBays: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        car: carConfigSchema.nullable(),
      }),
    )
    .max(6)
    .default([]),
  car: carConfigSchema.nullable(),
});
export const CAR_PRESETS: Record<CarConfig["style"], CarConfig> = {
  coupe: {
    shellMode: "preset",
    parts: [],
    ev: { ...DEFAULT_EV },
    style: "coupe",
    length: 4.4,
    width: 1.9,
    height: 1.3,
    wheelbase: 2.65,
    wheelRadius: 0.34,
    color: "#c66b3d",
    roofColor: "#303c41",
    spoiler: false,
  },
  sedan: {
    shellMode: "preset",
    parts: [],
    ev: { ...DEFAULT_EV },
    style: "sedan",
    length: 4.8,
    width: 1.85,
    height: 1.5,
    wheelbase: 2.85,
    wheelRadius: 0.33,
    color: "#5d7d99",
    roofColor: "#303c41",
    spoiler: false,
  },
  suv: {
    shellMode: "preset",
    parts: [],
    ev: { ...DEFAULT_EV },
    style: "suv",
    length: 4.9,
    width: 2.05,
    height: 1.85,
    wheelbase: 2.9,
    wheelRadius: 0.4,
    color: "#687b64",
    roofColor: "#303c41",
    spoiler: false,
  },
};
export const EMPTY_CAR_DOCUMENT: CarDocument = {
  version: 1,
  type: "car",
  name: "Untitled car",
  car: null,
  bays: [],
  activeBayId: null,
};
export function localCarCommand(
  current: CarConfig | null,
  text: string,
): { message: string; car: CarConfig | null } {
  const q = text.toLowerCase();
  const style = (["coupe", "sedan", "suv"] as const).find((s) => q.includes(s));
  if (!current && !/\b(create|build|add|design)\b/.test(q))
    throw new Error("Create a car first, or ask “create a coupe”.");
  let car = { ...(current || CAR_PRESETS[style || "coupe"]) };
  if (
    style &&
    (/\b(create|build|add|design)\b/.test(q) ||
      /\b(make|change|switch)\b/.test(q))
  )
    car = {
      ...CAR_PRESETS[style],
      color: current?.color || CAR_PRESETS[style].color,
    };
  const colors: Record<string, string> = {
    blue: "#5d7d99",
    orange: "#c66b3d",
    red: "#a9342b",
    green: "#687b64",
    white: "#e8e6e1",
    black: "#252b2e",
    yellow: "#e1b552",
  };
  let recognized = !current || Boolean(style);
  for (const [name, value] of Object.entries(colors))
    if (q.includes(name)) {
      car.color = value;
      recognized = true;
    }
  const dimensions: [
    keyof Pick<
      CarConfig,
      "length" | "width" | "height" | "wheelbase" | "wheelRadius"
    >,
    RegExp,
  ][] = [
    ["length", /(?:length|long)\D{0,12}(\d+(?:\.\d+)?)/],
    ["width", /(?:width|wide)\D{0,12}(\d+(?:\.\d+)?)/],
    ["height", /(?:height|tall)\D{0,12}(\d+(?:\.\d+)?)/],
    ["wheelbase", /wheelbase\D{0,12}(\d+(?:\.\d+)?)/],
    ["wheelRadius", /wheel radius\D{0,12}(\d+(?:\.\d+)?)/],
  ];
  for (const [key, pattern] of dimensions) {
    const match = q.match(pattern);
    if (match) {
      car[key] = Number(match[1]);
      recognized = true;
    }
  }
  if (q.includes("spoiler")) {
    car.spoiler = !/\b(remove|without|no)\b/.test(q);
    recognized = true;
  }
  if (!recognized)
    throw new Error(
      "Local commands support coupe/sedan/SUV, colors, “width 2.1”, “length 4.8”, “height 1.4”, “wheelbase 2.8”, “wheel radius 0.35” and adding/removing a spoiler. Use Meta for broader requests.",
    );
  car = carConfigSchema.parse(car);
  return {
    message:
      "Updated the parametric car using local commands. No AI call was made.",
    car,
  };
}
