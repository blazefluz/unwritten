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
import {
  describeDay,
  findPath,
  simulateDay,
  walkableGrid,
} from "../lib/studio/shoppers";

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
test("shoppers reach the example market, buy and pay at the counter", () => {
  const day = simulateDay(marketWorld());
  assert.equal(day.stats.visitors, 12);
  assert.equal(day.stats.gaveUp, 0);
  assert.ok(day.stats.bought > 0);
  assert.deepEqual(day.stats.blocked, []);
  for (const s of day.shoppers) {
    const ts = s.keyframes.map((k) => k.t);
    assert.deepEqual(
      ts,
      [...ts].sort((a, b) => a - b),
    );
    if (s.outcome === "bought") assert.ok(s.paidAt! >= s.pickedAt!);
  }
  assert.deepEqual(
    simulateDay(marketWorld(), 12, 3),
    simulateDay(marketWorld(), 12, 3),
  );
});
test("shopper paths never cross furniture footprints", () => {
  const world = {
    ...EMPTY_WORLD,
    objects: [{ ...makeObject("partition", 0, 0), scale: 2 }],
  };
  const path = findPath(world, { x: 0, z: 4.5 }, { x: 0, z: -4.5 })!;
  assert.ok(path.length > 2);
  const free = walkableGrid(world);
  assert.ok(free.some(Boolean));
  for (let k = 1; k < path.length; k++)
    for (let u = 0; u <= 1; u += 0.05) {
      const x = path[k - 1].x + (path[k].x - path[k - 1].x) * u;
      const z = path[k - 1].z + (path[k].z - path[k - 1].z) * u;
      assert.ok(!(Math.abs(x) < 2.4 && Math.abs(z) < 0.65), `${x},${z}`);
    }
});
test("a walled-off entrance and a missing counter show up in the results", () => {
  const market = marketWorld();
  const walled = {
    ...market,
    objects: [
      ...market.objects,
      ...[-4.8, -2.4, 0, 2.4, 4.8].map((x) => makeObject("partition", x, 4.6)),
    ],
  };
  const blocked = simulateDay(walled);
  assert.equal(blocked.stats.gaveUp, 12);
  assert.equal(blocked.stats.bought, 0);
  assert.match(describeDay(blocked), /gave up/);
  assert.equal(blocked.stats.entranceBlocked, true);
  assert.match(describeDay(blocked), /entrance.*blocked/);
  assert.equal(simulateDay(market).stats.entranceBlocked, false);
  const noCounter = {
    ...market,
    objects: market.objects.filter((o) => o.kind !== "counter"),
  };
  const unpaid = simulateDay(noCounter);
  assert.equal(unpaid.stats.bought, 0);
  assert.ok(unpaid.stats.noCheckout > 0);
  assert.match(describeDay(unpaid), /no display counter/);
});
test("paths can start inside furniture when snapping to the nearest free floor", () => {
  const world = { ...EMPTY_WORLD, objects: [makeObject("table", 0, 0)] };
  assert.equal(findPath(world, { x: 0, z: 0 }, { x: 4, z: 3 }), null);
  const path = findPath(
    world,
    { x: 0, z: 0 },
    { x: 4, z: 3 },
    walkableGrid(world),
    true,
  )!;
  assert.ok(path.length >= 2);
  assert.ok(Math.hypot(path.at(-1)!.x - 4, path.at(-1)!.z - 3) < 0.3);
});
