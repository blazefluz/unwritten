"use client";
import { useEffect, useState } from "react";
import {
  Check,
  ChevronRight,
  Download,
  Focus,
  Plus,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { analyzeEV, solveBattery, type EVConfig } from "@/lib/studio/ev";
import type { CarConfig, CarDocument } from "@/lib/studio/car";
import { sizeForTrip, testDrive, TRIP_KM } from "@/lib/studio/test-drive";
export type EngineeringTab =
  | "body"
  | "powertrain"
  | "analysis"
  | "parts"
  | "world";
type Props = {
  tab: EngineeringTab;
  car: CarConfig | null;
  document: CarDocument;
  busy: boolean;
  selectedPart: string | null;
  onSelect: (id: string | null) => void;
  onEv: (patch: Partial<EVConfig>) => void;
  onParts: (parts: CarConfig["parts"]) => void;
  onAddBay: () => void;
  onBay: (id: string) => void;
  onAsk: (prompt: string) => void;
  onExport: () => void;
};
type Field = {
  key: keyof EVConfig;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
};
const f = (
  key: keyof EVConfig,
  label: string,
  unit: string,
  min: number,
  max: number,
  step = 1,
): Field => ({ key, label, unit, min, max, step });
const groups: { name: string; note: string; fields: Field[] }[] = [
  {
    name: "Motor & reduction",
    note: "Ratings and efficiencies are input assumptions, not electromagnetic predictions. Rotor motion is a slowed illustration.",
    fields: [
      f("motorCount", "Drive motors", "", 1, 2),
      f("motorPowerKw", "Rated power / motor", "kW", 20, 400),
      f("motorTorqueNm", "Torque limit / motor", "Nm", 50, 900),
      f("maxRpm", "RPM limit", "rpm", 4000, 24000, 100),
      f("motorDiameter", "Housing diameter", "m", 0.18, 0.55, 0.01),
      f("motorLength", "Housing length", "m", 0.2, 0.7, 0.01),
      f("motorMassKg", "Motor mass / unit", "kg", 20, 200),
      f("gearRatio", "Reduction ratio", ":1", 4, 16, 0.1),
      f("gearEfficiency", "Gear efficiency", "fraction", 0.7, 1, 0.01),
      f(
        "motorEfficiency",
        "Motor + inverter efficiency",
        "fraction",
        0.6,
        0.99,
        0.01,
      ),
    ],
  },
  {
    name: "Battery pack",
    note: "Fixed illustrative 0.4 × 0.4 × 0.15 m module envelope. Capacity and mass require real component data.",
    fields: [
      f("moduleCount", "Module count", "", 4, 24),
      f("batteryColumns", "Modules across", "", 2, 4),
      f("moduleKwh", "Energy / module", "kWh", 1, 8, 0.1),
      f("moduleMassKg", "Mass / module", "kg", 10, 80),
      f("enclosureMassKg", "Pack enclosure mass", "kg", 10, 150),
      f("voltage", "Bus voltage", "V", 100, 1000, 10),
      f("packResistanceOhm", "Assumed pack resistance", "Ω", 0.001, 0.3, 0.001),
      f("maxCurrentA", "Current limit", "A", 50, 1500, 10),
      f("usableFraction", "Usable energy fraction", "", 0.5, 1, 0.01),
    ],
  },
  {
    name: "Vehicle & operating point",
    note: "Glider excludes EV drive/pack and AI-generated parts. Drive hardware allowance is 35 kg per motor. Cd is an assumption, not measured from the 3D body.",
    fields: [
      f("gliderMassKg", "Glider mass", "kg", 500, 2500, 10),
      f("payloadKg", "Payload", "kg", 0, 800, 10),
      f("speedKph", "Steady test speed", "km/h", 10, 200, 5),
      f("gradePercent", "Uphill grade", "%", 0, 20, 0.5),
      f("dragCoefficient", "Assumed drag coefficient", "Cd", 0.15, 0.8, 0.01),
      f("frontalAreaFactor", "Width × height area factor", "", 0.6, 1, 0.01),
      f("rollingCoefficient", "Rolling coefficient", "Crr", 0.005, 0.04, 0.001),
      f("airDensity", "Air density", "kg/m³", 0.8, 1.5, 0.025),
      f("auxiliariesKw", "Auxiliary load", "kW", 0, 10, 0.1),
    ],
  },
  {
    name: "Cooling assumptions",
    note: "Lumped heat balance only. No CFD, coolant routing resistance, temperature transients, or radiator validation.",
    fields: [
      f("radiatorUaWPerK", "Assumed radiator UA", "W/K", 20, 1500, 10),
      f("ambientC", "Ambient temperature", "°C", -20, 55),
      f("coolantC", "Mean coolant temperature", "°C", 30, 90),
      f("coolantDeltaT", "Coolant loop rise", "K", 2, 30),
      f("coolantCp", "Coolant heat capacity", "J/kg·K", 2000, 4500, 50),
    ],
  },
];
function NumberField({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function apply() {
    if (draft.trim() && Number.isFinite(Number(draft))) onChange(Number(draft));
    setDraft(String(value));
  }
  return (
    <label className="ev-number">
      <span>
        {field.label}
        <small>{field.unit}</small>
      </span>
      <input
        type="number"
        aria-label={field.label}
        min={field.min}
        max={field.max}
        step={field.step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
function downloadReport(car: CarConfig) {
  const report = {
    version: 1,
    kind: "concept-engineering-estimate",
    assumptions: car,
    results: analyzeEV(car),
    limitations:
      "Unvalidated assumed component data, constant efficiencies, steady speed, uphill grade only, no drive cycle/CFD/FEA/thermal transients. Motor ratings are inputs, not electromagnetic calculations. Not manufacturing specifications.",
    sources: [
      "https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/",
      "https://afdc.energy.gov/vehicles/how-do-all-electric-cars-work",
    ],
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "ev-engineering-estimate.json";
  a.click();
  URL.revokeObjectURL(url);
}
export default function EngineeringPanel(p: Props) {
  const [candidate, setCandidate] = useState<
    ReturnType<typeof solveBattery> | null | undefined
  >();
  const [goal, setGoal] = useState<"range" | "trip">("range");
  const [applied, setApplied] = useState<string | null>(null);
  useEffect(() => setCandidate(undefined), [p.car]);
  if (p.tab === "body") return null;
  if (p.tab === "world")
    return (
      <section className="ev-panel">
        <h2>Expandable workspace</h2>
        <p>
          Add independent design bays, compare concepts, and pan beyond the
          original scene. Up to 24 bays in this prototype.
        </p>
        <button
          className="ev-primary"
          disabled={p.busy || p.document.bays.length >= 24}
          onClick={p.onAddBay}
        >
          <Plus size={15} />
          Add design bay
        </button>
        <div className="ev-bays">
          {p.document.bays.map((b) => (
            <button
              key={b.id}
              disabled={p.busy}
              aria-pressed={b.id === p.document.activeBayId}
              onClick={() => p.onBay(b.id)}
            >
              <span>
                {b.name}
                <small>
                  {b.car
                    ? `${b.car.style} · ${b.car.parts.length} generated parts`
                    : "Empty design bay"}
                </small>
              </span>
              <Focus size={15} />
            </button>
          ))}
        </div>
        <p>
          Each bay holds a separate vehicle and generated assembly. World
          coordinates and designs are included in the exported JSON.
        </p>
      </section>
    );
  if (!p.car)
    return (
      <section className="ev-panel">
        <h2>Create a vehicle first</h2>
        <p>
          Choose Body to start a concept, or ask Muse to create an electric
          vehicle and its components.
        </p>
      </section>
    );
  const car = p.car,
    a = analyzeEV(car);
  if (p.tab === "parts")
    return (
      <section className="ev-panel">
        <h2>AI-created parts</h2>
        <p>
          Muse can author profiles, extrusions, revolved forms and custom
          meshes. These are new geometry, rather than catalog items.
        </p>
        <button
          className="ev-primary"
          disabled={p.busy}
          onClick={() =>
            p.onAsk(
              "Create a new aerodynamic cooling duct as custom extruded or mesh geometry, with a wide inlet and narrower outlet. Position it at the front of this EV. Preserve all existing parts and settings.",
            )
          }
        >
          <Sparkles size={14} />
          Describe a new part
        </button>
        {car.parts.length === 0 ? (
          <p>
            No generated parts yet. Describe the part, its function and where it
            connects.
          </p>
        ) : (
          car.parts.map((part) => (
            <div className="ev-generated" key={part.id}>
              <button
                disabled={p.busy}
                aria-pressed={part.id === p.selectedPart}
                onClick={() => p.onSelect(part.id)}
              >
                <strong>{part.name}</strong>
                <small>
                  {part.geometry.type} · {part.group}
                </small>
              </button>
              <p>{part.purpose}</p>
              <div>
                <span>
                  {part.massKg} kg <small>assumed</small>
                </span>
                <button
                  disabled={p.busy}
                  aria-label={`Remove ${part.name}`}
                  onClick={() =>
                    p.onParts(car.parts.filter((a) => a.id !== part.id))
                  }
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <details>
                <summary>Geometry definition</summary>
                <pre>{JSON.stringify(part.geometry, null, 2)}</pre>
              </details>
            </div>
          ))
        )}
        <button className="ev-secondary" onClick={p.onExport}>
          <Download size={14} />
          Export assembly OBJ
        </button>
        <p>
          Mesh indices, finite coordinates and basic degeneracy are checked.
          Watertightness, manufacturability and part strength are not
          established. Part masses are estimates, not derived from materials.
        </p>
      </section>
    );
  if (p.tab === "powertrain")
    return (
      <section className="ev-panel">
        <h2>Electric architecture</h2>
        <p>
          Edit the assembly and its explicit assumptions. Chassis or exploded
          view reveals the components.
        </p>
        <div className="ev-subsystems">
          {[
            "Chassis",
            "Battery modules",
            "Drive units",
            "Cooling loop",
            "Power electronics",
          ].map((name) => (
            <button
              key={name}
              aria-pressed={p.selectedPart === name}
              onClick={() => p.onSelect(name)}
            >
              {name}
              <ChevronRight size={13} />
            </button>
          ))}
        </div>
        <fieldset disabled={p.busy}>
          {groups.map((group, i) => (
            <details key={group.name} open={i === 0}>
              <summary>{group.name}</summary>
              <p>{group.note}</p>
              {group.fields.map((field) => (
                <NumberField
                  key={field.key}
                  field={field}
                  value={car.ev[field.key]}
                  onChange={(value) => p.onEv({ [field.key]: value })}
                />
              ))}
            </details>
          ))}
        </fieldset>
      </section>
    );
  const metrics: [string, number, string][] = [
    ["Steady-speed range estimate", a.rangeKm, "km"],
    ["Pack energy use", a.whPerKm, "Wh/km"],
    ["Battery nominal energy", a.capacityKwh, "kWh"],
    ["Assumed total mass", a.massKg, "kg"],
    ["Assumed frontal area", a.frontalAreaM2, "m²"],
    ["Aerodynamic force", a.dragN, "N"],
    ["Rolling force", a.rollingN, "N"],
    ["Uphill force", a.gradeN, "N"],
    ["Wheel power required", a.wheelPowerKw, "kW"],
    ["Battery bus power", a.busPowerKw, "kW"],
    ["Bus current", a.currentA, "A"],
    ["Motor speed", a.motorRpm, "rpm"],
    ["Gearing RPM ceiling", a.gearingCeilingKph, "km/h"],
    ["Estimated losses to coolant", a.heatKw, "kW"],
    ["Assumed radiator rejection", a.radiatorCapacityKw, "kW"],
    ["Coolant flow requirement", a.coolantFlowKgS, "kg/s"],
  ];
  return (
    <section className="ev-panel">
      <h2>Engineering estimates</h2>
      <p>
        Computed in code at {car.ev.speedKph} km/h, {car.ev.gradePercent}%
        uphill grade. All results depend on entered assumptions.
      </p>
      <div className="ev-checks">
        {a.checks.map((c) => (
          <div key={c.id} className={c.ok ? "ev-check-ok" : "ev-check-warn"}>
            {c.ok ? <Check size={13} /> : <TriangleAlert size={13} />}
            <span>
              {c.label}
              <small>{c.detail}</small>
            </span>
          </div>
        ))}
      </div>
      <table className="ev-results">
        <caption>Analytical results · not measured performance</caption>
        <tbody>
          {metrics.map(([label, value, unit]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>
                {value.toFixed(unit === "kg/s" ? 3 : 1)} <span>{unit}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <details className="ev-formulas">
        <summary>Equations & assumptions</summary>
        <p>
          Drag = ½ρCdAv². A = width × height × area factor. Rolling = mgCrr
          cos(atan grade). Grade force = mg sin(atan grade). Wheel power = total
          force × speed. Bus power = wheel power ÷ efficiencies + auxiliaries.
          Battery heat = I²R. Range = usable kWh ÷ pack kW × speed. Cooling flow
          = heat ÷ (Cp × ΔT); rejection = UA × (coolant − ambient).
        </p>
        <p>
          Constant efficiency, steady speed, no acceleration or regeneration, no
          wind, no drive cycle. No CFD, FEA, electromagnetic or transient
          thermal analysis. Motor ratings and radiator UA are assumptions.
          Gearing ceiling is not an achievable top-speed prediction.
        </p>
        <a
          href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/"
          target="_blank"
          rel="noreferrer"
        >
          NASA drag equation
        </a>
        <a
          href="https://afdc.energy.gov/vehicles/how-do-all-electric-cars-work"
          target="_blank"
          rel="noreferrer"
        >
          US DOE EV architecture
        </a>
      </details>
      <div className="ev-sizing">
        <h3>Battery sizing study</h3>
        <NumberField
          field={f(
            "targetRangeKm",
            "Target steady-speed range",
            "km",
            50,
            800,
            10,
          )}
          value={car.ev.targetRangeKm}
          onChange={(value) => p.onEv({ targetRangeKm: value })}
        />
        <p>
          Searches 63 module-count / column layouts. Keeps other inputs fixed
          and selects the lightest candidate meeting the range target and all
          listed checks.
        </p>
        <button
          disabled={p.busy}
          className="ev-primary"
          onClick={() => {
            setGoal("range");
            setApplied(null);
            setCandidate(solveBattery(car));
          }}
        >
          Run sizing study
        </button>
        <button
          disabled={p.busy}
          className="ev-secondary"
          onClick={() => {
            setGoal("trip");
            setApplied(null);
            setCandidate(sizeForTrip(car));
          }}
        >
          Size for the {TRIP_KM} km test drive
        </button>
        {candidate !== undefined &&
          (candidate ? (
            <div className="ev-candidate">
              <strong>
                {candidate.ev.moduleCount} modules ·{" "}
                {candidate.ev.batteryColumns} across
              </strong>
              <p>
                {candidate.analysis.capacityKwh.toFixed(1)} kWh,{" "}
                {candidate.analysis.rangeKm.toFixed(0)} km estimated,{" "}
                {candidate.analysis.massKg.toFixed(0)} kg assumed total mass.
              </p>
              <p>
                Now: {car.ev.moduleCount} modules, {a.capacityKwh.toFixed(1)}{" "}
                kWh. Test drive with this candidate:{" "}
                {(() => {
                  const d = testDrive({ ...car, ev: candidate.ev });
                  return d.arrived
                    ? `completes the ${TRIP_KM} km trip.`
                    : `stops at ${Math.round(d.reachedKm)} of ${TRIP_KM} km.`;
                })()}
              </p>
              <button
                disabled={p.busy}
                onClick={() => {
                  setApplied(
                    `Applied ${candidate.ev.moduleCount} modules (${candidate.analysis.capacityKwh.toFixed(1)} kWh), was ${car.ev.moduleCount}. Run Test drive to try it.`,
                  );
                  p.onEv(candidate.ev);
                }}
              >
                Apply candidate
              </button>
            </div>
          ) : (
            <p role="status">
              {goal === "trip"
                ? `No battery layout completes the ${TRIP_KM} km test drive with the other inputs fixed. Try a lower drag coefficient, a smaller body or a different drivetrain; no design was changed.`
                : "No candidate meets this target and the checks. Change the target or assumptions; no design was changed."}
            </p>
          ))}
        {applied && candidate === undefined && (
          <p role="status" className="ev-applied">
            {applied}
          </p>
        )}
      </div>
      <button className="ev-secondary" onClick={() => downloadReport(car)}>
        <Download size={14} />
        Export calculation report
      </button>
    </section>
  );
}
