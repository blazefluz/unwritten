// A fixed test-drive trip scored with the car scene's existing steady-speed EV
// estimates (analyzeEV). It is a deterministic comparison tool: constant speed
// per leg, no regeneration, no traffic or temperature effects. It is not a
// vehicle simulation.
import type { CarConfig } from "./car";
import { analyzeEV } from "./ev";

export type Leg = {
  id: "city" | "highway" | "climb" | "descent";
  name: string;
  km: number;
  speedKph: number;
  gradePercent: number;
};
export const TRIP: Leg[] = [
  { id: "city", name: "City streets", km: 20, speedKph: 50, gradePercent: 0 },
  { id: "highway", name: "Highway", km: 220, speedKph: 120, gradePercent: 0 },
  {
    id: "climb",
    name: "Mountain climb",
    km: 40,
    speedKph: 70,
    gradePercent: 8,
  },
  // Descent is scored as flat driving: regeneration is not modelled.
  { id: "descent", name: "Descent", km: 40, speedKph: 70, gradePercent: 0 },
];
export const TRIP_KM = TRIP.reduce((sum, leg) => sum + leg.km, 0);
export const GARAGE = { heightM: 2.0, widthM: 2.3 };

export type DriveCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};
export type DriveResult = {
  /** Kilometre at which the car stopped; TRIP_KM if it arrived. */
  reachedKm: number;
  arrived: boolean;
  parked: boolean;
  stop: string | null;
  usableKwh: number;
  usedKwh: number;
  legs: {
    leg: Leg;
    startKm: number;
    endKm: number;
    kwhPerKm: number;
    problem: string | null;
  }[];
  checks: DriveCheck[];
};

export function testDrive(car: CarConfig): DriveResult {
  const base = analyzeEV({ ...car, ev: { ...car.ev } });
  const usableKwh = base.capacityKwh * car.ev.usableFraction;
  let km = 0,
    used = 0,
    stop: string | null = null;
  const legs: DriveResult["legs"] = [];
  const legChecks: DriveCheck[] = [];
  for (const leg of TRIP) {
    const a = analyzeEV({
      ...car,
      ev: { ...car.ev, speedKph: leg.speedKph, gradePercent: leg.gradePercent },
    });
    const failed = (id: string) => a.checks.find((c) => c.id === id && !c.ok);
    const problem =
      failed("rpm") && leg.speedKph > 60
        ? `Motor speed limit: ${a.checks.find((c) => c.id === "rpm")!.detail}`
        : failed("torque") || failed("power") || failed("current")
          ? `Not enough drive: ${(failed("torque") || failed("power") || failed("current"))!.detail}`
          : failed("cooling")
            ? `Overheating: ${failed("cooling")!.detail}`
            : null;
    const kwhPerKm = a.packPowerKw / leg.speedKph;
    const startKm = km;
    if (problem && !stop) {
      stop = `${leg.name}: ${problem}`;
      legs.push({ leg, startKm, endKm: startKm, kwhPerKm, problem });
      break;
    }
    const left = usableKwh - used;
    const possible = left / kwhPerKm;
    if (possible < leg.km) {
      km += possible;
      used = usableKwh;
      stop = `Battery empty during ${leg.name.toLowerCase()}`;
      legs.push({ leg, startKm, endKm: km, kwhPerKm, problem: null });
      break;
    }
    km += leg.km;
    used += leg.km * kwhPerKm;
    legs.push({ leg, startKm, endKm: km, kwhPerKm, problem: null });
    if (leg.id === "highway")
      legChecks.push({
        id: "highway",
        label: "Highway at 120 km/h",
        ok: true,
        detail: `${(kwhPerKm * 100).toFixed(1)} kWh/100 km`,
      });
    if (leg.id === "climb")
      legChecks.push({
        id: "climb",
        label: "8% mountain climb",
        ok: true,
        detail: `${Math.round(a.availableWheelForceN)} N available / ${Math.round(a.roadForceN)} N needed; ${a.heatKw.toFixed(1)} / ${a.radiatorCapacityKw.toFixed(1)} kW cooling`,
      });
  }
  const arrived = !stop;
  const fitsHeight = car.height <= GARAGE.heightM;
  const fitsWidth = car.width <= GARAGE.widthM;
  const parked = arrived && fitsHeight && fitsWidth;
  if (arrived && !parked)
    stop = !fitsHeight
      ? `Too tall for the ${GARAGE.heightM.toFixed(1)} m garage (${car.height.toFixed(2)} m)`
      : `Too wide for the ${GARAGE.widthM.toFixed(1)} m garage (${car.width.toFixed(2)} m)`;
  const stoppedLeg = legs.find((l) => l.problem);
  const checks: DriveCheck[] = [
    {
      id: "range",
      label: `${TRIP_KM} km trip on one charge`,
      ok: arrived,
      detail: `${Math.round(Math.min(km, TRIP_KM))} of ${TRIP_KM} km · ${usableKwh.toFixed(1)} kWh usable`,
    },
    ...legChecks,
    ...(stoppedLeg
      ? [
          {
            id: stoppedLeg.leg.id,
            label: stoppedLeg.leg.name,
            ok: false,
            detail: stoppedLeg.problem!,
          },
        ]
      : []),
    {
      id: "garage",
      label: `Fits a ${GARAGE.heightM.toFixed(1)} × ${GARAGE.widthM.toFixed(1)} m garage`,
      ok: fitsHeight && fitsWidth,
      detail: `${car.height.toFixed(2)} m tall, ${car.width.toFixed(2)} m wide`,
    },
  ];
  return {
    reachedKm: Math.min(km, TRIP_KM),
    arrived,
    parked,
    stop,
    usableKwh,
    usedKwh: Math.min(used, usableKwh),
    legs,
    checks,
  };
}

/** Battery fraction remaining when the car has driven `km` along the trip. */
export function batteryAt(result: DriveResult, km: number) {
  let used = 0;
  for (const l of result.legs) {
    if (km <= l.startKm) break;
    used += (Math.min(km, l.endKm) - l.startKm) * l.kwhPerKm;
  }
  return Math.max(0, 1 - used / result.usableKwh);
}

export function legAt(km: number): Leg {
  let start = 0;
  for (const leg of TRIP) {
    if (km < start + leg.km) return leg;
    start += leg.km;
  }
  return TRIP[TRIP.length - 1];
}

/** Plain-language summary for people and for Muse. */
export function describeDrive(result: DriveResult): string {
  const parts = [
    result.parked
      ? `Completed the ${TRIP_KM} km test trip and parked in the garage with ${Math.round((1 - result.usedKwh / result.usableKwh) * 100)}% battery left.`
      : `Stopped at ${Math.round(result.reachedKm)} of ${TRIP_KM} km. ${result.stop}.`,
  ];
  const failing = result.checks.filter((c) => !c.ok && c.id !== "range");
  for (const c of failing) parts.push(`${c.label}: ${c.detail}.`);
  parts.push(
    "Trip: 20 km city at 50 km/h, 220 km highway at 120 km/h, 40 km 8% climb at 70 km/h, 40 km descent (no regeneration), then a 2.0 m × 2.3 m garage.",
  );
  return parts.join(" ");
}
