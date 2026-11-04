import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  EMPTY_WORLD,
  applyProposal,
  footprint,
  inspectScene,
  normalizeProposal,
  photoProposalSchema,
  type Design,
} from "../lib/studio/scene";
import { describeDay, simulateDay } from "../lib/studio/shoppers";
import { sampleStore } from "../lib/studio/store-sample";

const fridge: Design = {
  id: "fridge",
  name: "Fridge",
  kind: "shelf",
  size: [1.2, 2, 0.7],
  description: "",
  parts: [
    { shape: "box", size: [1.2, 2, 0.7], offset: [0, 1, 0], color: "#ffffff" },
  ],
};

test("Muse-made items take their footprint from the design", () => {
  const world = applyProposal(EMPTY_WORLD, {
    message: "",
    designs: [fridge],
    actions: [
      {
        type: "add",
        object: {
          id: "f1",
          kind: "shelf",
          label: "Fridge",
          x: 0,
          z: -4.5,
          rotation: 90,
          scale: 1,
          color: "#ffffff",
          designId: "fridge",
        },
      },
    ],
  });
  const f = world.objects[0];
  assert.deepEqual(f.size, [1.2, 2, 0.7]);
  assert.equal(f.parts?.length, 1);
  assert.deepEqual(footprint(f), { w: 0.7, d: 1.2 });
});

test("an instance of a missing design is rejected", () => {
  assert.throws(() =>
    applyProposal(EMPTY_WORLD, {
      message: "",
      actions: [
        {
          type: "add",
          object: {
            id: "f1",
            kind: "shelf",
            label: "Fridge",
            x: 0,
            z: 0,
            rotation: 0,
            scale: 1,
            color: "#ffffff",
            designId: "nope",
          },
        },
      ],
    }),
  );
});

test("products on removed fixtures are dropped; null products leave the catalog alone", () => {
  const store = sampleStore();
  const kept = applyProposal(store, {
    message: "",
    actions: [],
    products: null,
  });
  assert.equal(kept.products?.length, store.products?.length);
  const gone = applyProposal(store, {
    message: "",
    actions: [{ type: "remove", id: "produce" }],
  });
  assert.ok(gone.products?.every((p) => p.fixtureId !== "produce"));
});

test("the scripted sample store is valid, clear and sells its catalog", () => {
  const store = sampleStore();
  assert.deepEqual(inspectScene(store), []);
  const day = simulateDay(store);
  assert.equal(day.stats.catalog, true);
  assert.ok(day.stats.unitsSold > 0);
  const total = day.stats.sales.reduce((a, s) => a + s.revenue, 0);
  assert.ok(Math.abs(total - day.stats.revenue) < 0.01);
  for (const s of day.stats.sales) {
    const p = store.products!.find((x) => x.id === s.id)!;
    assert.equal(s.stockLeft, p.stock - s.units);
    assert.ok(s.stockLeft >= 0);
  }
  assert.match(describeDay(day), /Revenue/);
  assert.deepEqual(simulateDay(store).stats, day.stats);
});

test("shoppers who want a sold-out product are counted as missed sales", () => {
  const store = sampleStore();
  store.products = store.products!.map((p) => ({ ...p, stock: 0 }));
  const day = simulateDay(store);
  assert.equal(day.stats.unitsSold, 0);
  assert.ok(day.stats.sales.some((s) => s.missed > 0));
  assert.equal(day.stats.soldOut.length, store.products.length);
});

test("model numbers are clamped into range, references still checked strictly", () => {
  const raw = {
    message: "Built",
    name: "Shop",
    observed: ["Two fridges"],
    designs: [{ ...fridge, size: [1.2, 3.4, 0.7] }],
    products: [
      {
        id: "milk",
        name: "Milk",
        price: -1,
        stock: 12.6,
        fixtureId: "f1",
        color: "#ffffff",
      },
    ],
    actions: [
      {
        type: "add",
        reason: "Fridge on the back wall.",
        object: {
          id: "f1",
          kind: "shelf",
          label: "Fridge",
          x: 0,
          z: -6,
          rotation: 0,
          scale: 1,
          color: "#ffffff",
          designId: "fridge",
        },
      },
      {
        type: "add",
        reason: "Counter by the door.",
        object: {
          id: "c1",
          kind: "counter",
          label: "Till",
          x: 3,
          z: 3,
          rotation: 0,
          scale: 1,
          color: "#ffffff",
          designId: null,
        },
      },
    ],
  };
  const store = photoProposalSchema.parse(normalizeProposal(raw));
  assert.equal(store.designs![0].size[1], 3);
  assert.equal(store.products![0].price, 0);
  assert.equal(store.products![0].stock, 13);
  const world = applyProposal({ ...EMPTY_WORLD, name: store.name }, store);
  assert.equal(world.objects[1].designId, undefined);
  assert.equal(world.objects[0].z, -5);
});
