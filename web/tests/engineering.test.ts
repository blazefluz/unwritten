import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  CAR_PRESETS,
  carDocumentSchema,
  carConfigSchema,
} from "../lib/studio/car";
import { analyzeEV, solveBattery } from "../lib/studio/ev";
import {
  addDesignBay,
  selectDesignBay,
  synchronizeDocument,
} from "../lib/studio/world";
import {
  generatedPartSchema,
  type GeneratedPart,
} from "../lib/studio/generated-parts";
import {
  createGeneratedPart,
  generatedPartBounds,
} from "../lib/studio/part-model";
import { carResponseSchema } from "../lib/studio/car-ai-schema";
import { createEVAssembly } from "../lib/studio/ev-model";
import { disposeCarGroup } from "../lib/studio/car-model";
const car = structuredClone(CAR_PRESETS.coupe);
const part: GeneratedPart = {
  id: "duct-1",
  name: "Flared cooling inlet",
  purpose: "A newly authored tapered duct concept",
  geometry: {
    type: "extrude",
    profile: [
      [-0.3, 0],
      [0.3, 0],
      [0.2, 0.25],
      [-0.2, 0.25],
    ],
    depth: 0.3,
  },
  position: [1.5, 0.35, 0],
  rotation: [0, 90, 0],
  color: "#a7afb1",
  material: "metal",
  group: "cooling",
  massKg: 2,
};
test("road-load equations agree with independent closed-form values", () => {
  const c = {
    ...car,
    ev: {
      ...car.ev,
      gradePercent: 0,
      auxiliariesKw: 0,
      packResistanceOhm: 0.001,
    },
  };
  const a = analyzeEV(c),
    v = c.ev.speedKph / 3.6;
  const drag = 0.5 * 1.225 * 0.3 * (car.width * car.height * 0.85) * v * v;
  const rolling = a.massKg * 9.80665 * 0.012;
  assert.ok(Math.abs(a.dragN - drag) < 1e-8);
  assert.ok(Math.abs(a.rollingN - rolling) < 1e-8);
  assert.ok(Math.abs(a.wheelPowerKw - ((drag + rolling) * v) / 1000) < 1e-8);
  assert.ok(Math.abs(a.busPowerKw - a.wheelPowerKw / (0.96 * 0.92)) < 1e-8);
  assert.ok(Math.abs(a.rangeKm - ((54 * 0.9) / a.packPowerKw) * 100) < 1e-8);
});
test("geometry/engineering checks flag impossible packs and cooling assumptions", () => {
  const a = analyzeEV({
    ...car,
    ev: {
      ...car.ev,
      moduleCount: 24,
      batteryColumns: 2,
      ambientC: 55,
      coolantC: 30,
    },
  });
  assert.equal(a.checks.find((c) => c.id === "pack-length")?.ok, false);
  assert.equal(a.checks.find((c) => c.id === "cooling")?.ok, false);
  assert.equal(a.radiatorCapacityKw, 0);
});
test("battery sizing returns minimum count with feasible layout or no solution", () => {
  const result = solveBattery(car);
  assert.ok(result);
  assert.ok(result.analysis.rangeKm >= car.ev.targetRangeKm);
  assert.ok(result.analysis.checks.every((c) => c.ok));
  for (let count = 4; count < result.ev.moduleCount; count++)
    for (const cols of [2, 3, 4] as const) {
      const a = analyzeEV({
        ...car,
        ev: { ...car.ev, moduleCount: count, batteryColumns: cols },
      });
      assert.ok(
        a.rangeKm < car.ev.targetRangeKm || a.checks.some((c) => !c.ok),
      );
    }
  assert.equal(
    solveBattery({ ...car, ev: { ...car.ev, targetRangeKm: 800 } }),
    null,
  );
});
test("world expansion preserves existing concepts and switching edits only active bay", () => {
  const doc = synchronizeDocument(
    carDocumentSchema.parse({ version: 1, type: "car", name: "World", car }),
  );
  const expanded = addDesignBay(doc);
  assert.equal(expanded.bays.length, 2);
  assert.equal(expanded.bays[1].x, 10);
  assert.deepEqual(expanded.bays[0].car, car);
  const changed = synchronizeDocument({
    ...expanded,
    car: { ...expanded.car!, width: 2.2 },
  });
  const switched = selectDesignBay(changed, doc.activeBayId!);
  assert.equal(switched.car?.width, car.width);
  assert.equal(switched.bays[1].car?.width, 2.2);
  assert.equal(
    carDocumentSchema.safeParse({ ...changed, activeBayId: "missing" }).success,
    false,
  );
});
test("new custom geometry is parsed, built and positioned without a catalog entry", () => {
  const valid = generatedPartSchema.parse(part),
    mesh = createGeneratedPart(valid),
    bounds = generatedPartBounds(valid);
  assert.equal(mesh.name, part.name);
  assert.ok(Number.isFinite(bounds.min.x));
  assert.ok(bounds.getSize(mesh.position.clone()).length() > 0);
  mesh.geometry.dispose();
  (mesh.material as { dispose: () => void }).dispose();
  assert.equal(
    analyzeEV({ ...car, parts: [valid] }).massKg,
    analyzeEV(car).massKg + 2,
  );
});
test("bad mesh indices and zero-area profiles are rejected", () => {
  assert.equal(
    generatedPartSchema.safeParse({
      ...part,
      geometry: {
        type: "mesh",
        vertices: [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
        ],
        triangles: [[0, 1, 9]],
      },
    }).success,
    false,
  );
  assert.equal(
    generatedPartSchema.safeParse({
      ...part,
      geometry: {
        type: "extrude",
        profile: [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
        depth: 0.2,
      },
    }).success,
    false,
  );
  assert.equal(
    generatedPartSchema.safeParse({
      ...part,
      geometry: {
        type: "mesh",
        vertices: [
          [0, 0, 0],
          [1, 0, 0],
          [2, 0, 0],
        ],
        triangles: [[0, 1, 2]],
      },
    }).success,
    false,
  );
});
test("structured response schema is inline, nonrecursive and includes generative tools", () => {
  const schema = carResponseSchema(),
    text = JSON.stringify(schema);
  assert.ok(!text.includes('"$ref"'));
  assert.ok(!text.includes('"prefixItems"'));
  assert.ok(!text.includes('"items":false'));
  assert.ok(text.includes('"extrude"'));
  assert.ok(text.includes('"mesh"'));
  assert.ok(text.includes('"ev"'));
  assert.ok(text.includes('"parts"'));
});
test("EV assembly creates battery modules, drive units and spinning rotor components", () => {
  const mesh = createEVAssembly(car, "exploded");
  let rotors = 0;
  mesh.traverse((o) => {
    if (o.userData.rotor) rotors++;
  });
  assert.equal(rotors, 1);
  assert.ok(mesh.children.some((g) => g.name === "Battery modules"));
  disposeCarGroup(mesh);
});
test("older car files migrate to EV defaults without generated parts", () => {
  const { ev, parts, ...legacy } = car;
  const migrated = carConfigSchema.parse(legacy);
  assert.equal(migrated.ev.moduleCount, 12);
  assert.deepEqual(migrated.parts, []);
});

test("creation requests cannot pass with only a completion claim", async () => {
  const { checkCreationResult } = await import("../lib/studio/creation-check");
  assert.throws(() =>
    checkCreationResult(car, car, "Create a new cooling duct"),
  );
  assert.doesNotThrow(() =>
    checkCreationResult(
      car,
      { ...car, parts: [part] },
      "Create a new cooling duct",
    ),
  );
  assert.doesNotThrow(() =>
    checkCreationResult(car, car, "What is this duct for?"),
  );
});

test("AI-authored bays preserve the current design and retain generated geometry", async () => {
  const { appendDesignBays } = await import("../lib/studio/world");
  const original = synchronizeDocument(
    carDocumentSchema.parse({
      version: 1,
      type: "car",
      name: "Design world",
      car,
    }),
  );
  const next = appendDesignBays(original, [
    { name: "Cooling study", car: { ...car, parts: [part] } },
  ]);
  assert.equal(next.bays.length, 2);
  assert.equal(next.activeBayId, original.activeBayId);
  assert.deepEqual(next.car, original.car);
  assert.equal(next.bays[1].car?.parts[0].name, part.name);
  const { checkCreationResult } = await import("../lib/studio/creation-check");
  assert.doesNotThrow(() =>
    checkCreationResult(car, car, "Create a new duct in a new bay", [
      next.bays[1].car,
    ]),
  );
});
