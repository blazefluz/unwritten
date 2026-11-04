import { strict as assert } from "node:assert";
import { test } from "node:test";
import * as THREE from "three";
import {
  CAR_PRESETS,
  carConfigSchema,
  carDocumentSchema,
  localCarCommand,
} from "../lib/studio/car";
import { createCarModel, disposeCarGroup } from "../lib/studio/car-model";

test("presets are valid and contain four wheels within their visual envelope", () => {
  for (const car of Object.values(CAR_PRESETS)) {
    carConfigSchema.parse(car);
    const mesh = createCarModel(car);
    const size = new THREE.Box3()
      .setFromObject(mesh)
      .getSize(new THREE.Vector3());
    assert.equal(mesh.children.filter((m) => m.name === "wheel").length, 4);
    assert.ok(
      Math.abs(size.x - car.length) < 0.015,
      `length ${size.x} vs ${car.length}`,
    );
    assert.ok(
      Math.abs(size.y - car.height) < 0.015,
      `height ${size.y} vs ${car.height}`,
    );
    assert.ok(
      Math.abs(size.z - car.width) < 0.02,
      `width ${size.z} vs ${car.width}`,
    );
    disposeCarGroup(mesh);
  }
});
test("geometry responds independently to body dimensions and wheelbase", () => {
  const base = CAR_PRESETS.coupe;
  const config = {
    ...base,
    length: 5.5,
    width: 2.3,
    height: 1.7,
    wheelbase: 3.4,
    spoiler: true,
  };
  const mesh = createCarModel(carConfigSchema.parse(config));
  const wheels = mesh.children.filter((m) => m.name === "wheel");
  assert.equal(wheels[0].position.x, -1.7);
  assert.equal(wheels[2].position.x, 1.7);
  assert.equal(mesh.children.filter((m) => m.name === "spoiler").length, 1);
  const size = new THREE.Box3()
    .setFromObject(mesh)
    .getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - 5.5) < 0.015);
  assert.ok(Math.abs(size.z - 2.3) < 0.02);
  disposeCarGroup(mesh);
});
test("invalid wheel fit and nonfinite dimensions are rejected without mutating the car", () => {
  const car = { ...CAR_PRESETS.coupe };
  const before = structuredClone(car);
  assert.equal(
    carConfigSchema.safeParse({ ...car, length: 3, wheelbase: 3 }).success,
    false,
  );
  assert.equal(
    carConfigSchema.safeParse({ ...car, width: Infinity }).success,
    false,
  );
  assert.throws(() => localCarCommand(car, "wheelbase 4.2"));
  assert.deepEqual(car, before);
});
test("local car edits preserve unrelated dimensions and parse multiple requested changes", () => {
  const car = { ...CAR_PRESETS.coupe };
  const next = localCarCommand(
    car,
    "make it blue, width 2.1 and add a spoiler",
  ).car!;
  assert.equal(next.color, "#5d7d99");
  assert.equal(next.width, 2.1);
  assert.equal(next.spoiler, true);
  assert.equal(next.length, car.length);
  assert.equal(next.height, car.height);
  assert.equal(localCarCommand(null, "create an SUV").car?.style, "suv");
});
test("car documents remain distinct from market documents", () => {
  assert.equal(
    carDocumentSchema.safeParse({
      version: 1,
      name: "Market",
      lighting: "day",
      objects: [],
    }).success,
    false,
  );
  assert.equal(
    carDocumentSchema.safeParse({
      version: 1,
      type: "car",
      name: "Concept",
      car: CAR_PRESETS.coupe,
    }).success,
    true,
  );
});
