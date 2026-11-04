import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  EMPTY_WORLD,
  applyProposal,
  findSpace,
  footprint,
  inspectScene,
  localCommand,
  makeObject,
  marketWorld,
  repairPlacement,
  sceneSchema,
  proposalSchema,
  MARKET_REASONS,
} from "../lib/studio/scene";

test("example layout has unique IDs, stays inside the room, and has no overlaps", () => {
  const example = marketWorld();
  assert.equal(sceneSchema.safeParse(example).success, true);
  assert.deepEqual(inspectScene(example), []);
});
test("geometry accounts for rotation, scaling, and floor rugs", () => {
  const a = { ...makeObject("table"), rotation: 90 as const, scale: 1.5 };
  assert.ok(Math.abs(footprint(a).w - 1.8) < 1e-9);
  assert.ok(Math.abs(footprint(a).d - 3.6) < 1e-9);
  const world = {
    ...EMPTY_WORLD,
    objects: [makeObject("table"), makeObject("rug")],
  };
  assert.deepEqual(inspectScene(world), []);
  world.objects.push(makeObject("chair"));
  assert.equal(inspectScene(world).length, 1);
});
test("an invalid batch never mutates the source scene", () => {
  const source = { ...EMPTY_WORLD, objects: [makeObject("table")] };
  const before = JSON.stringify(source);
  assert.throws(() =>
    applyProposal(source, {
      message: "test",
      actions: [
        { type: "remove", id: source.objects[0].id },
        { type: "remove", id: "missing" },
      ],
    }),
  );
  assert.equal(JSON.stringify(source), before);
});
test("overlap and room bounds produce conflicts, and repair preserves other objects", () => {
  const table = makeObject("table"),
    chair = makeObject("chair");
  const scene = { ...EMPTY_WORLD, objects: [table, chair] };
  assert.equal(inspectScene(scene).length, 1);
  const repaired = repairPlacement(scene, [chair.id]);
  assert.ok(repaired);
  assert.deepEqual(inspectScene(repaired), []);
  assert.deepEqual(repaired.objects[0], table);
  assert.ok(
    inspectScene({ ...EMPTY_WORLD, objects: [{ ...table, x: 5.8 }] }).length,
  );
});
test("automatic placement finds space around an existing large object", () => {
  const huge = { ...makeObject("rug"), kind: "table" as const, scale: 2 };
  const room = { ...EMPTY_WORLD, objects: [huge] };
  const object = makeObject("chair");
  const candidate = findSpace(room, object);
  assert.ok(candidate);
  assert.deepEqual(
    inspectScene({ ...room, objects: [...room.objects, candidate] }),
    [],
  );
});
test("local commands preserve object identity and require selection for contextual edits", () => {
  const table = makeObject("table");
  const scene = { ...EMPTY_WORLD, objects: [table] };
  const result = applyProposal(
    scene,
    localCommand(scene, "move this right 1 metre", table.id),
  );
  assert.equal(result.objects[0].x, 1);
  assert.equal(result.objects[0].id, table.id);
  assert.throws(() => localCommand(scene, "rotate this", null));
  assert.equal(
    applyProposal(scene, localCommand(scene, "make it nighttime", null))
      .lighting,
    "night",
  );
});
test("import rejects duplicate IDs, arbitrary object kinds and non-finite coordinates", () => {
  const a = makeObject("table");
  for (const objects of [
    [a, a],
    [{ ...a, kind: "script" }],
    [{ ...a, x: NaN }],
  ])
    assert.equal(
      sceneSchema.safeParse({ ...EMPTY_WORLD, objects }).success,
      false,
    );
});
test("build reasons are optional, bounded, and scripted only for the example", () => {
  const object = makeObject("table");
  const ok = proposalSchema.safeParse({
    message: "Add a table",
    actions: [{ type: "add", object, reason: "Anchors the room." }],
  });
  assert.equal(ok.success, true);
  assert.equal(
    proposalSchema.safeParse({
      message: "Add a table",
      actions: [{ type: "add", object }],
    }).success,
    true,
  );
  assert.equal(
    proposalSchema.safeParse({
      message: "Add a table",
      actions: [{ type: "add", object, reason: "x".repeat(161) }],
    }).success,
    false,
  );
  const scripted = localCommand(EMPTY_WORLD, "build a market", null);
  assert.ok(scripted.actions.every((a) => a.type === "add" && a.reason));
  assert.ok(marketWorld().objects.every((o) => MARKET_REASONS[o.label]));
});
