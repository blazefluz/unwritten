// Build order for the visible car assembly. Each step's line is generated from
// the design's own numbers (or, for AI-authored parts, the part's stated
// purpose), so the narration describes the design actually on screen.
import type { CarConfig } from "./car";
import { analyzeEV } from "./ev";

export type AssemblyStep = {
  /** EV subsystem group name, "wheels", "body", or "part:<id>". */
  key: string;
  line: string;
};

const m = (v: number) => `${v.toFixed(2)} m`;

export function assemblySteps(car: CarConfig): AssemblyStep[] {
  const ev = car.ev,
    a = analyzeEV(car);
  const steps: AssemblyStep[] = [
    {
      key: "Chassis",
      line: `Laying the platform: ${m(car.wheelbase)} between the axles.`,
    },
    {
      key: "Battery modules",
      line: `${ev.moduleCount} battery modules, ${a.capacityKwh.toFixed(0)} kWh, flat between the axles to keep the weight low.`,
    },
    {
      key: "Drive units",
      line:
        ev.motorCount === 2
          ? `Two ${ev.motorPowerKw} kW motors, one per axle, for grip on climbs.`
          : `One ${ev.motorPowerKw} kW motor with a ${ev.gearRatio}:1 reduction.`,
    },
    {
      key: "Power electronics",
      line: `Inverter at ${ev.voltage} V, rated for ${ev.maxCurrentA} A.`,
    },
    {
      key: "Cooling loop",
      line: `Coolant loop to shed ${a.radiatorCapacityKw.toFixed(1)} kW of heat.`,
    },
    {
      key: "wheels",
      line: `${m(car.wheelRadius * 2)} wheels at each corner.`,
    },
  ];
  if (car.shellMode !== "generated")
    steps.push({
      key: "body",
      line: `The ${car.style === "suv" ? "SUV" : car.style} body: ${m(car.length)} long, ${m(car.height)} tall, drag coefficient ${ev.dragCoefficient}.`,
    });
  for (const part of car.parts)
    steps.push({
      key: `part:${part.id}`,
      line: `${part.name}: ${part.purpose}`.slice(0, 140),
    });
  return steps;
}
