import { z } from "zod";
export const DEFAULT_EV = {
  motorCount: 1 as 1 | 2,
  motorPowerKw: 120,
  motorTorqueNm: 280,
  maxRpm: 14000,
  motorDiameter: 0.32,
  motorLength: 0.4,
  motorMassKg: 65,
  gearRatio: 9,
  gearEfficiency: 0.96,
  motorEfficiency: 0.92,
  moduleCount: 12,
  batteryColumns: 3 as 2 | 3 | 4,
  moduleKwh: 4.5,
  moduleMassKg: 25,
  enclosureMassKg: 40,
  voltage: 400,
  packResistanceOhm: 0.04,
  maxCurrentA: 400,
  gliderMassKg: 1000,
  payloadKg: 150,
  dragCoefficient: 0.3,
  frontalAreaFactor: 0.85,
  rollingCoefficient: 0.012,
  airDensity: 1.225,
  speedKph: 100,
  gradePercent: 0,
  auxiliariesKw: 1.5,
  usableFraction: 0.9,
  radiatorUaWPerK: 250,
  ambientC: 25,
  coolantC: 60,
  coolantDeltaT: 10,
  coolantCp: 3600,
  targetRangeKm: 250,
};
export const evSchema = z.object({
  motorCount: z.union([z.literal(1), z.literal(2)]),
  motorPowerKw: z.number().finite().min(20).max(400),
  motorTorqueNm: z.number().finite().min(50).max(900),
  maxRpm: z.number().finite().min(4000).max(24000),
  motorDiameter: z.number().finite().min(0.18).max(0.55),
  motorLength: z.number().finite().min(0.2).max(0.7),
  motorMassKg: z.number().finite().min(20).max(200),
  gearRatio: z.number().finite().min(4).max(16),
  gearEfficiency: z.number().finite().min(0.7).max(1),
  motorEfficiency: z.number().finite().min(0.6).max(0.99),
  moduleCount: z.number().int().min(4).max(24),
  batteryColumns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  moduleKwh: z.number().finite().min(1).max(8),
  moduleMassKg: z.number().finite().min(10).max(80),
  enclosureMassKg: z.number().finite().min(10).max(150),
  voltage: z.number().finite().min(100).max(1000),
  packResistanceOhm: z.number().finite().min(0.001).max(0.3),
  maxCurrentA: z.number().finite().min(50).max(1500),
  gliderMassKg: z.number().finite().min(500).max(2500),
  payloadKg: z.number().finite().min(0).max(800),
  dragCoefficient: z.number().finite().min(0.15).max(0.8),
  frontalAreaFactor: z.number().finite().min(0.6).max(1),
  rollingCoefficient: z.number().finite().min(0.005).max(0.04),
  airDensity: z.number().finite().min(0.8).max(1.5),
  speedKph: z.number().finite().min(10).max(200),
  gradePercent: z.number().finite().min(0).max(20),
  auxiliariesKw: z.number().finite().min(0).max(10),
  usableFraction: z.number().finite().min(0.5).max(1),
  radiatorUaWPerK: z.number().finite().min(20).max(1500),
  ambientC: z.number().finite().min(-20).max(55),
  coolantC: z.number().finite().min(30).max(90),
  coolantDeltaT: z.number().finite().min(2).max(30),
  coolantCp: z.number().finite().min(2000).max(4500),
  targetRangeKm: z.number().finite().min(50).max(800),
});
export type EVConfig = z.infer<typeof evSchema>;
export type EVCar = {
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  wheelRadius: number;
  ev: EVConfig;
  parts?: { massKg: number }[];
};
export const MODULE = { length: 0.4, width: 0.4, height: 0.15, gap: 0.025 };
export function packEnvelope(ev: EVConfig) {
  const rows = Math.ceil(ev.moduleCount / ev.batteryColumns);
  return {
    rows,
    length: rows * (MODULE.length + MODULE.gap) + 0.025,
    width: ev.batteryColumns * (MODULE.width + MODULE.gap) + 0.025,
    height: MODULE.height + 0.05,
  };
}
export function analyzeEV(car: EVCar) {
  const e = evSchema.parse(car.ev),
    pack = packEnvelope(e);
  const capacityKwh = e.moduleCount * e.moduleKwh;
  const batteryMassKg = e.moduleCount * e.moduleMassKg + e.enclosureMassKg;
  // 35 kg allowance for inverter, reduction gear, cooling and cables per drive unit.
  const driveMassKg = e.motorCount * (e.motorMassKg + 35);
  const customMassKg = (car.parts || []).reduce((sum, p) => sum + p.massKg, 0);
  const massKg =
    e.gliderMassKg + e.payloadKg + batteryMassKg + driveMassKg + customMassKg;
  const v = e.speedKph / 3.6,
    gradeAngle = Math.atan(e.gradePercent / 100);
  const frontalAreaM2 = car.width * car.height * e.frontalAreaFactor;
  const dragN = 0.5 * e.airDensity * e.dragCoefficient * frontalAreaM2 * v * v;
  const rollingN =
    massKg * 9.80665 * e.rollingCoefficient * Math.cos(gradeAngle);
  const gradeN = massKg * 9.80665 * Math.sin(gradeAngle);
  const roadForceN = dragN + rollingN + gradeN;
  const wheelPowerKw = (roadForceN * v) / 1000;
  const shaftPowerKw = wheelPowerKw / e.gearEfficiency;
  const busPowerKw = shaftPowerKw / e.motorEfficiency + e.auxiliariesKw;
  const currentA = (busPowerKw * 1000) / e.voltage;
  const batteryHeatKw = (currentA * currentA * e.packResistanceOhm) / 1000;
  const packPowerKw = busPowerKw + batteryHeatKw;
  const rangeKm = ((capacityKwh * e.usableFraction) / packPowerKw) * e.speedKph;
  const motorRpm = (v / (2 * Math.PI * car.wheelRadius)) * 60 * e.gearRatio;
  const omega = (motorRpm * Math.PI) / 30;
  const motorTorqueNm = Math.min(
    e.motorTorqueNm,
    (e.motorPowerKw * 1000) / omega,
  );
  const availableWheelForceN =
    (motorTorqueNm * e.motorCount * e.gearRatio * e.gearEfficiency) /
    car.wheelRadius;
  const gearingCeilingKph =
    (((e.maxRpm / e.gearRatio) * 2 * Math.PI * car.wheelRadius) / 60) * 3.6;
  const driveHeatKw = shaftPowerKw / e.motorEfficiency - wheelPowerKw;
  const heatKw = driveHeatKw + batteryHeatKw;
  const radiatorCapacityKw = Math.max(
    0,
    (e.radiatorUaWPerK * (e.coolantC - e.ambientC)) / 1000,
  );
  const coolantFlowKgS = (heatKw * 1000) / (e.coolantCp * e.coolantDeltaT);
  const checks = [
    {
      id: "pack-length",
      label: "Battery between axle keep-outs",
      ok: pack.length <= car.wheelbase - 0.65,
      detail: `${pack.length.toFixed(2)} m pack / ${(car.wheelbase - 0.65).toFixed(2)} m envelope`,
    },
    {
      id: "pack-width",
      label: "Battery inside sill envelope",
      ok: pack.width <= car.width - 0.4,
      detail: `${pack.width.toFixed(2)} m pack / ${(car.width - 0.4).toFixed(2)} m envelope`,
    },
    {
      id: "motor-fit",
      label: "Motor / reduction axle envelope",
      ok:
        e.motorLength + 0.22 <= car.width - 0.35 &&
        e.motorDiameter <= car.wheelRadius * 2,
      detail: `Ø${e.motorDiameter.toFixed(2)} × ${e.motorLength.toFixed(2)} m motor; envelope check only`,
    },
    {
      id: "rpm",
      label: "Motor RPM at test speed",
      ok: motorRpm <= e.maxRpm,
      detail: `${Math.round(motorRpm)} / ${e.maxRpm} RPM`,
    },
    {
      id: "torque",
      label: "Available force at test speed",
      ok: availableWheelForceN >= roadForceN,
      detail: `${Math.round(availableWheelForceN)} N available / ${Math.round(roadForceN)} N required`,
    },
    {
      id: "power",
      label: "Assumed motor power capacity",
      ok: shaftPowerKw <= e.motorPowerKw * e.motorCount,
      detail: `${shaftPowerKw.toFixed(1)} / ${(e.motorPowerKw * e.motorCount).toFixed(0)} kW shaft power`,
    },
    {
      id: "current",
      label: "Battery current assumption",
      ok: currentA <= e.maxCurrentA,
      detail: `${currentA.toFixed(1)} / ${e.maxCurrentA} A`,
    },
    {
      id: "cooling",
      label: "Lumped cooling heat balance",
      ok: heatKw <= radiatorCapacityKw,
      detail: `${heatKw.toFixed(2)} kW loss / ${radiatorCapacityKw.toFixed(2)} kW assumed rejection`,
    },
  ];
  return {
    capacityKwh,
    batteryMassKg,
    driveMassKg,
    customMassKg,
    massKg,
    frontalAreaM2,
    dragN,
    rollingN,
    gradeN,
    roadForceN,
    wheelPowerKw,
    shaftPowerKw,
    busPowerKw,
    currentA,
    batteryHeatKw,
    packPowerKw,
    rangeKm,
    whPerKm: (packPowerKw / e.speedKph) * 1000,
    motorRpm,
    availableWheelForceN,
    gearingCeilingKph,
    driveHeatKw,
    heatKw,
    radiatorCapacityKw,
    coolantFlowKgS,
    checks,
    pack,
  };
}
export function solveBattery(car: EVCar) {
  const candidates: { ev: EVConfig; analysis: ReturnType<typeof analyzeEV> }[] =
    [];
  for (let moduleCount = 4; moduleCount <= 24; moduleCount++)
    for (const batteryColumns of [2, 3, 4] as const) {
      const ev = { ...car.ev, moduleCount, batteryColumns };
      const analysis = analyzeEV({ ...car, ev });
      if (
        analysis.checks.every((c) => c.ok) &&
        analysis.rangeKm >= ev.targetRangeKm
      )
        candidates.push({ ev, analysis });
    }
  return (
    candidates.sort(
      (a, b) =>
        a.analysis.massKg - b.analysis.massKg ||
        a.analysis.pack.width - b.analysis.pack.width,
    )[0] || null
  );
}
