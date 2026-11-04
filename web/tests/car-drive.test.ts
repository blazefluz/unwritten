import { strict as assert } from "node:assert";
import { test } from "node:test";
import { CAR_PRESETS } from "../lib/studio/car";
import { assemblySteps } from "../lib/studio/car-assembly";
import {
  TRIP_KM,
  batteryAt,
  describeDrive,
  testDrive,
} from "../lib/studio/test-drive";

test("the stock coupe runs out before the end of the trip", () => {
  const r = testDrive(CAR_PRESETS.coupe);
  assert.equal(r.arrived, false);
  assert.ok(r.reachedKm > 100 && r.reachedKm < TRIP_KM);
  assert.equal(r.checks.find((c) => c.id === "range")!.ok, false);
  assert.match(describeDrive(r), /Battery empty/);
});
test("a bigger battery completes the trip and parks", () => {
  const car = {
    ...CAR_PRESETS.coupe,
    ev: { ...CAR_PRESETS.coupe.ev, moduleCount: 20 },
  };
  const r = testDrive(car);
  assert.equal(r.arrived, true);
  assert.equal(r.parked, true);
  assert.equal(r.reachedKm, TRIP_KM);
  assert.ok(batteryAt(r, TRIP_KM) > 0);
  assert.ok(batteryAt(r, 0) === 1 && batteryAt(r, 100) < 1);
});
test("a tall car finishes the trip but cannot park", () => {
  const car = {
    ...CAR_PRESETS.suv,
    height: 2.15,
    ev: { ...CAR_PRESETS.suv.ev, moduleCount: 24, moduleKwh: 8 },
  };
  const r = testDrive(car);
  assert.equal(r.arrived, true);
  assert.equal(r.parked, false);
  assert.match(r.stop!, /Too tall/);
  assert.equal(r.checks.find((c) => c.id === "garage")!.ok, false);
});
test("a weak motor stalls on the climb", () => {
  const car = {
    ...CAR_PRESETS.suv,
    ev: {
      ...CAR_PRESETS.suv.ev,
      moduleCount: 24,
      motorPowerKw: 20,
      motorTorqueNm: 50,
    },
  };
  const r = testDrive(car);
  assert.equal(r.arrived, false);
  assert.ok(r.checks.some((c) => !c.ok && c.id !== "range"));
});
test("assembly narration follows the design's own numbers", () => {
  const car = CAR_PRESETS.sedan;
  const steps = assemblySteps(car);
  assert.deepEqual(steps.map((s) => s.key).slice(0, 6), [
    "Chassis",
    "Battery modules",
    "Drive units",
    "Power electronics",
    "Cooling loop",
    "wheels",
  ]);
  assert.ok(steps[1].line.includes(String(car.ev.moduleCount)));
  assert.ok(steps.some((s) => s.key === "body"));
  assert.ok(
    !assemblySteps({ ...car, shellMode: "generated" }).some(
      (s) => s.key === "body",
    ),
  );
});
