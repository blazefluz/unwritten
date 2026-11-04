"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import {
  ArrowUp,
  ArrowUpRight,
  Box,
  CarFront,
  Check,
  ChevronDown,
  Download,
  Eye,
  Grid2X2,
  LoaderCircle,
  Maximize2,
  Pause,
  Play,
  Plus,
  Ruler,
  Sparkles,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import SceneSwitch from "./scene-switch";
import {
  CAR_PRESETS,
  EMPTY_CAR_DOCUMENT,
  carConfigSchema,
  carDocumentSchema,
  localCarCommand,
  type CarConfig,
  type CarDocument,
} from "@/lib/studio/car";
import type { CarView } from "./car-viewport";
import { normalizeCarProposal } from "@/lib/studio/car-proposal";
import EngineeringPanel, { type EngineeringTab } from "./engineering-panel";
import { evSchema, type EVConfig } from "@/lib/studio/ev";
import {
  synchronizeDocument,
  addDesignBay,
  selectDesignBay,
  appendDesignBays,
} from "@/lib/studio/world";
import type { AssemblyMode } from "@/lib/studio/ev-model";
const CarViewport = dynamic(() => import("./car-viewport"), {
  ssr: false,
  loading: () => (
    <div className="ws-scene-loading">
      <LoaderCircle className="ws-spin" size={22} />
      Opening the design studio…
    </div>
  ),
});
const STORAGE = "world-studio.car.v1";
type Message = { role: "user" | "assistant"; text: string; source?: string };
const fields = [
  {
    key: "length",
    label: "Length",
    min: 3,
    max: 6,
    step: 0.05,
    description: "Front bumper to rear bumper",
  },
  {
    key: "width",
    label: "Width",
    min: 1.5,
    max: 2.5,
    step: 0.05,
    description: "Overall width, including wheels",
  },
  {
    key: "height",
    label: "Height",
    min: 1.1,
    max: 2.2,
    step: 0.05,
    description: "Ground to roof",
  },
  {
    key: "wheelbase",
    label: "Wheelbase",
    min: 1.9,
    max: 4.2,
    step: 0.05,
    description: "Distance between axle centres",
  },
  {
    key: "wheelRadius",
    label: "Wheel radius",
    min: 0.25,
    max: 0.48,
    step: 0.01,
    description: "Tyre radius; all four wheels",
  },
] as const;
function errorText(error: unknown) {
  return error instanceof z.ZodError
    ? error.issues.map((i) => i.message).join(" ")
    : error instanceof Error
      ? error.message
      : "The design could not be updated. Your previous car is unchanged.";
}
function DimensionNumber({
  value,
  label,
  min,
  max,
  step,
  id,
  onCommit,
}: {
  value: number;
  label: string;
  min: number;
  max: number;
  step: number;
  id: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  function finish() {
    if (draft.trim() && Number.isFinite(Number(draft))) onCommit(Number(draft));
    setDraft(String(value));
  }
  return (
    <input
      id={id}
      aria-label={`${label} in metres`}
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}
export default function CarStudio() {
  const [document, setDocument] = useState<CarDocument>(EMPTY_CAR_DOCUMENT),
    [history, setHistory] = useState<CarDocument[]>([]);
  const [section, setSection] = useState<EngineeringTab>("body");
  const [assemblyMode, setAssemblyMode] = useState<AssemblyMode>("body");
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [runDrive, setRunDrive] = useState(false);
  const [loaded, setLoaded] = useState(false),
    [view, setView] = useState<CarView>("perspective"),
    [dimensions, setDimensions] = useState(true),
    [paused, setPaused] = useState(false);
  const [mode, setMode] = useState<"local" | "meta">("local"),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(""),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Your market scene is saved separately."),
    [panel, setPanel] = useState<"dimensions" | "chat">("chat");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Describe your electric vehicle or a new part to create. I can build custom profiles and meshes, change the drivetrain, and assemble your design. Ask me to create more design bays for alternatives. Use EV, AI parts and Analysis to inspect results and assumptions.",
      source: "Studio welcome",
    },
  ]);
  const upload = useRef<HTMLInputElement>(null),
    log = useRef<HTMLDivElement>(null),
    request = useRef<AbortController | null>(null);
  const car = document.car;
  const currentDocument = useRef(document);
  currentDocument.current = document;
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/studio", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setReady(Boolean(data.ready));
        if (data.ready) setMode("meta");
      })
      .catch(() => {});
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved) {
        setDocument(
          synchronizeDocument(carDocumentSchema.parse(JSON.parse(saved))),
        );
        setStatus("Restored your car design. Market scene is unchanged.");
      }
    } catch {
      setError(
        "Could not restore the car draft. Start a car or import a valid backup.",
      );
    }
    setLoaded(true);
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    function synchronize(event: StorageEvent) {
      if (event.key !== STORAGE || !event.newValue) return;
      try {
        const next = synchronizeDocument(
          carDocumentSchema.parse(JSON.parse(event.newValue)),
        );
        if (JSON.stringify(next) === JSON.stringify(currentDocument.current))
          return;
        currentDocument.current = next;
        setDocument(next);
        setHistory([]);
        setSelectedPart(null);
        setStatus("Loaded the latest saved world from another studio tab.");
      } catch {
        setStatus(
          "Another tab wrote an incompatible draft. Your current design is preserved; export a backup.",
        );
      }
    }
    window.addEventListener("storage", synchronize);
    return () => window.removeEventListener("storage", synchronize);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(document));
    } catch {
      setStatus("Browser storage unavailable. Export your car to keep it.");
    }
  }, [loaded, document]);
  useEffect(() => {
    log.current?.scrollTo({
      top: log.current.scrollHeight,
      behavior: "instant",
    });
  }, [messages, busy]);
  function message(text: string, source: string) {
    setMessages((m) => [...m.slice(-39), { role: "assistant", text, source }]);
  }
  function commit(
    next: CarDocument,
    note = "Design updated and saved in this browser.",
  ) {
    const valid = synchronizeDocument(next);
    currentDocument.current = valid;
    setHistory((h) => [...h.slice(-29), document]);
    setDocument(valid);
    setError("");
    setStatus(note);
  }
  function edit(patch: Partial<CarConfig>) {
    if (!car || busy) return;
    try {
      const next = carConfigSchema.parse({ ...car, ...patch });
      commit({ ...document, car: next });
    } catch (e) {
      setError(errorText(e));
    }
  }
  function preset(style: CarConfig["style"]) {
    if (busy) return;
    commit({ ...document, car: { ...CAR_PRESETS[style] } });
    message(
      `Created the ${style === "suv" ? "SUV" : style} preset. Change its dimensions, paint or details to make it yours.`,
      "Built-in preset · no AI",
    );
  }
  function undo() {
    if (busy || !history.length) return;
    setDocument(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    setError("");
    setStatus("Undid the last car change.");
  }
  async function submit(e?: FormEvent, supplied?: string) {
    e?.preventDefault();
    const text = (supplied || prompt).trim();
    if (!text || busy || request.current) return;
    setPrompt("");
    setError("");
    setMessages((m) => [...m.slice(-39), { role: "user", text }]);
    if (mode === "local") {
      try {
        const next = localCarCommand(car, text);
        if (JSON.stringify(next.car) !== JSON.stringify(car))
          commit({ ...document, car: next.car });
        message(next.message, "Local command · no AI");
      } catch (error) {
        setError(errorText(error));
        setPrompt(text);
      }
      return;
    }
    const controller = new AbortController();
    const baseDocument = JSON.stringify(document);
    request.current = controller;
    setBusy(true);
    const timer = setTimeout(() => controller.abort(), 230000);
    try {
      const response = await fetch("/api/studio/car", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          car,
          prompt: text,
          selectedPart,
          worldSummary: document.bays.map((b) => ({
            name: b.name,
            style: b.car?.style || null,
            partCount: b.car?.parts.length || 0,
          })),
        }),
        signal: controller.signal,
      });
      const raw = await response.json();
      if (!response.ok)
        throw new Error(raw.error || "Meta could not finish this design.");
      const proposal = normalizeCarProposal(raw, car);
      if (JSON.stringify(currentDocument.current) !== baseDocument)
        throw new Error(
          "The saved world changed in another tab while Muse was working. The response was not applied. Retry against the current design.",
        );
      if (
        JSON.stringify(proposal.car) !== JSON.stringify(car) ||
        proposal.newBays.length
      )
        commit(
          appendDesignBays(
            { ...document, car: proposal.car },
            proposal.newBays,
          ),
        );
      if (proposal.newBays.length) {
        setView("world");
        setSection("world");
      }
      message(
        proposal.message,
        raw.revised
          ? "Meta · geometry checked and revised"
          : "Meta · Muse Spark",
      );
      if ((proposal.car?.parts.length || 0) > (car?.parts.length || 0)) {
        setSection("parts");
        setAssemblyMode("exploded");
      }
    } catch (error) {
      setError(
        controller.signal.aborted
          ? "Request stopped. The design is unchanged. A submitted Meta call may still finish on the server."
          : errorText(error),
      );
      setPrompt(text);
    } finally {
      clearTimeout(timer);
      request.current = null;
      setBusy(false);
    }
  }
  function editEV(patch: Partial<EVConfig>) {
    if (!car || busy) return;
    try {
      edit({ ev: evSchema.parse({ ...car.ev, ...patch }) });
    } catch (e) {
      setError(errorText(e));
    }
  }
  function addBay() {
    if (busy) return;
    try {
      commit(
        addDesignBay(document),
        "Added an independent design bay. Your existing concepts are preserved.",
      );
      setView("perspective");
      setSection("world");
    } catch (e) {
      setError(errorText(e));
    }
  }
  function selectBay(id: string) {
    if (busy) return;
    try {
      commit(selectDesignBay(document, id), "Switched active design bay.");
      setView("perspective");
      setSelectedPart(null);
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function exportGeometry() {
    if (!car) return;
    try {
      const [
        { OBJExporter },
        { createCarModel },
        { createEVAssembly },
        { createGeneratedPart },
        { Group },
      ] = await Promise.all([
        import("three/addons/exporters/OBJExporter.js"),
        import("@/lib/studio/car-model"),
        import("@/lib/studio/ev-model"),
        import("@/lib/studio/part-model"),
        import("three"),
      ]);
      const assembly = new Group();
      const shell = createCarModel(car);
      if (car.shellMode === "generated")
        for (const child of shell.children)
          if (child.userData.subsystem !== "wheels") child.visible = false;
      // OBJExporter exports geometry regardless of visibility, so remove hidden preset shell parts.
      for (const child of [...shell.children])
        if (!child.visible) shell.remove(child);
      assembly.add(shell, createEVAssembly(car, "chassis"));
      car.parts.forEach((p) => assembly.add(createGeneratedPart(p)));
      const text =
        "# Concept assembly; units: metres. Not manufacturing CAD.\n" +
        new OBJExporter().parse(assembly);
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
      const link = window.document.createElement("a");
      link.href = url;
      link.download = "ev-concept-assembly.obj";
      link.click();
      URL.revokeObjectURL(url);
      const { disposeCarGroup } = await import("@/lib/studio/car-model");
      disposeCarGroup(assembly);
      setStatus(
        "Exported concept mesh in metres. Engineering assumptions are in the JSON report.",
      );
    } catch {
      setError(
        "The mesh export failed. Your design is preserved; JSON export is still available.",
      );
    }
  }
  function exportCar() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(document, null, 2)], {
        type: "application/json",
      }),
    );
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${document.name.replace(/[^a-z0-9_-]/gi, "-") || "concept"}.car.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Car design exported. Market scene is saved separately.");
  }
  async function importCar(file?: File) {
    if (!file || busy) return;
    try {
      if (file.size > 2_000_000)
        throw new Error("Choose a car world JSON smaller than 2 MB.");
      const next = carDocumentSchema.parse(JSON.parse(await file.text()));
      commit(next, "Imported car design. Undo is available.");
    } catch {
      setError(
        "That file is not a valid car design. Market scene files belong in the Market scene. Your current car is unchanged.",
      );
    }
    if (upload.current) upload.current.value = "";
  }
  return (
    <main className="ws-app car-app">
      <a className="ws-skip" href="#car-command">
        Skip to design command
      </a>
      <header className="ws-header">
        <a className="ws-brand" href="/studio" aria-label="World Studio home">
          <span className="ws-brand-cube">
            <Box size={22} strokeWidth={1.7} />
          </span>
          <span>
            world<span className="ws-brand-light">studio</span>
            <span className="ws-brand-dot">.</span>
          </span>
        </a>
        <SceneSwitch current="car" />
        <div className="ws-project">
          <span className="ws-divider" />
          <input
            aria-label="Car design name"
            value={document.name}
            maxLength={100}
            disabled={busy}
            onChange={(e) => setDocument({ ...document, name: e.target.value })}
            onBlur={() => {
              if (!document.name.trim())
                setDocument({ ...document, name: "Untitled car" });
            }}
          />
        </div>
        <div className="ws-header-actions">
          <button
            className="ws-icon-button"
            aria-label="Undo car change"
            title="Undo car change"
            disabled={!history.length || busy}
            onClick={undo}
          >
            <Undo2 size={18} />
          </button>
          <button
            className="ws-text-button ws-import"
            disabled={busy}
            onClick={() => upload.current?.click()}
          >
            <Upload size={16} />
            Import
          </button>
          <button className="ws-export" onClick={exportCar}>
            <Download size={15} />
            <span>Export car</span>
          </button>
        </div>
        <input
          ref={upload}
          type="file"
          accept=".json,application/json"
          className="visually-hidden"
          aria-label="Import car JSON"
          disabled={busy}
          onChange={(e) => void importCar(e.target.files?.[0])}
        />
      </header>
      <div className="car-mobile-switch">
        <button
          aria-pressed={panel === "dimensions"}
          onClick={() => setPanel("dimensions")}
        >
          <Ruler size={15} />
          Design tools
        </button>
        <button
          aria-pressed={panel === "chat"}
          onClick={() => setPanel("chat")}
        >
          <Sparkles size={15} />
          Collaborator
        </button>
      </div>
      <div className="car-workspace" data-panel={panel}>
        <aside className="car-properties" aria-label="Car design controls">
          <nav className="car-tool-tabs" aria-label="Design tool panels">
            {(
              [
                ["body", "Body"],
                ["powertrain", "EV"],
                ["parts", "AI parts"],
                ["analysis", "Analysis"],
                ["world", "World"],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                aria-pressed={section === tab}
                onClick={() => setSection(tab)}
              >
                {label}
              </button>
            ))}
          </nav>
          <div hidden={section !== "body"}>
            <div className="car-properties-title">
              <h2>Shape your car</h2>
              <CarFront size={19} />
            </div>
            <p className="car-properties-intro">
              Start with a silhouette.
              <br />
              Every dimension changes the model.
            </p>
            <fieldset className="car-presets" disabled={busy}>
              <legend>Starting body style</legend>
              {(["coupe", "sedan", "suv"] as const).map((style) => (
                <button
                  key={style}
                  aria-pressed={car?.style === style}
                  onClick={() => preset(style)}
                >
                  <CarFront size={17} />
                  <span>
                    {style === "suv"
                      ? "SUV"
                      : style[0].toUpperCase() + style.slice(1)}
                  </span>
                  <Plus size={12} />
                </button>
              ))}
            </fieldset>
            {car ? (
              <>
                <label className="car-shell-mode">
                  Body geometry
                  <select
                    aria-label="Body geometry source"
                    disabled={busy}
                    value={car.shellMode}
                    onChange={(e) =>
                      edit({
                        shellMode: e.target.value as CarConfig["shellMode"],
                      })
                    }
                  >
                    <option value="preset">
                      Starting shell + custom parts
                    </option>
                    <option value="generated">AI-created body only</option>
                  </select>
                </label>
                <fieldset className="car-dimensions" disabled={busy}>
                  <legend>
                    Dimensions <span>metres</span>
                  </legend>
                  {fields.map((field) => (
                    <div className="car-dimension" key={field.key}>
                      <div>
                        <label htmlFor={`car-${field.key}`}>
                          {field.label}
                        </label>
                        <span>
                          <DimensionNumber
                            id={`car-${field.key}`}
                            label={field.label}
                            step={field.step}
                            min={field.min}
                            max={field.max}
                            value={car[field.key]}
                            onCommit={(value) => edit({ [field.key]: value })}
                          />
                          m
                        </span>
                      </div>
                      <input
                        type="range"
                        aria-label={`${field.label} slider`}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={car[field.key]}
                        onChange={(e) =>
                          edit({ [field.key]: Number(e.target.value) })
                        }
                      />
                      <p>{field.description}</p>
                    </div>
                  ))}
                </fieldset>
                <fieldset className="car-finish" disabled={busy}>
                  <legend>Finish & details</legend>
                  <label>
                    Body paint
                    <input
                      type="color"
                      aria-label="Car body paint"
                      value={car.color}
                      onChange={(e) => edit({ color: e.target.value })}
                    />
                  </label>
                  <label>
                    Roof finish
                    <input
                      type="color"
                      aria-label="Car roof finish"
                      value={car.roofColor}
                      onChange={(e) => edit({ roofColor: e.target.value })}
                    />
                  </label>
                  <label>
                    Rear spoiler
                    <input
                      type="checkbox"
                      checked={car.spoiler}
                      onChange={(e) => edit({ spoiler: e.target.checked })}
                    />
                  </label>
                </fieldset>
                <button
                  className="car-new"
                  disabled={busy}
                  onClick={() => {
                    commit(
                      { ...document, car: null },
                      "Cleared the car. Undo is available.",
                    );
                  }}
                >
                  <Plus size={15} />
                  Start a new car
                </button>
              </>
            ) : (
              <div className="car-properties-empty">
                <Ruler size={27} strokeWidth={1.2} />
                <p>Your dimensions will appear here once you create a car.</p>
              </div>
            )}
            <p className="car-control-note">
              Concept geometry only.
              <br />
              No engineering or aerodynamic simulation.
            </p>
          </div>
          <EngineeringPanel
            tab={section}
            car={car}
            document={document}
            busy={busy}
            selectedPart={selectedPart}
            onSelect={(id) => {
              setSelectedPart(id);
              setAssemblyMode("exploded");
            }}
            onEv={editEV}
            onParts={(parts) => edit({ parts })}
            onAddBay={addBay}
            onBay={selectBay}
            onAsk={(text) => {
              setPrompt(text);
              window.document.getElementById("car-command")?.focus();
            }}
            onExport={() => void exportGeometry()}
          />
        </aside>
        <section
          className="ws-stage car-stage"
          aria-label="3D car design studio"
        >
          <CarViewport
            bays={document.bays}
            activeBayId={document.activeBayId}
            assemblyMode={assemblyMode}
            selectedPart={selectedPart}
            runDrive={runDrive}
            car={car}
            dimensions={dimensions}
            view={view}
            busy={busy}
            paused={paused}
          />
          <div className="ws-stage-heading">
            <div>
              <span className="ws-stage-tag">
                <span />
                Car design studio
              </span>
              <h1>
                {car
                  ? "Give your idea a shape."
                  : "Your next concept starts here."}
              </h1>
              <p>
                {car
                  ? "Change the proportions. See the difference."
                  : "Create a car, then design it together."}
              </p>
            </div>
            <button
              className="car-dimension-toggle"
              aria-pressed={dimensions}
              title="Toggle dimension guides"
              onClick={() => setDimensions(!dimensions)}
            >
              <Ruler size={17} />
              <span>Dimensions</span>
            </button>
          </div>
          <div className="car-assembly-toolbar" aria-label="Assembly view">
            {(
              [
                ["body", "Body"],
                ["chassis", "EV chassis"],
                ["exploded", "Exploded"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={assemblyMode === value}
                onClick={() => setAssemblyMode(value)}
              >
                {label}
              </button>
            ))}
            <button
              aria-pressed={runDrive}
              disabled={!car}
              onClick={() => {
                setRunDrive(!runDrive);
                setAssemblyMode("exploded");
              }}
            >
              {runDrive ? "Stop rotor" : "Show rotor motion"}
            </button>
            <button disabled={busy} onClick={addBay}>
              <Plus size={13} />
              Add bay
            </button>
          </div>
          {!car && (
            <div className="ws-start">
              <button disabled={busy} onClick={() => preset("coupe")}>
                Create a coupe
                <CarFront size={17} />
              </button>
              <span>Editable parametric model · built-in preset</span>
            </div>
          )}
          {car && (
            <div className="car-spec-strip" aria-label="Current car dimensions">
              <span>
                <strong>{car.length.toFixed(2)}</strong>m length
              </span>
              <span>
                <strong>{car.width.toFixed(2)}</strong>m width
              </span>
              <span>
                <strong>{car.height.toFixed(2)}</strong>m height
              </span>
            </div>
          )}
          <div className="ws-stage-note">
            <span className="ws-avatar-marker" />
            <span>
              {busy
                ? "Muse is considering your design…"
                : "Muse is here to shape it with you"}
            </span>
          </div>
          <div className="ws-viewport-tools">
            <div className="ws-views" aria-label="Car camera view">
              {(
                [
                  ["perspective", Maximize2, "Orbit"],
                  ["side", CarFront, "Side"],
                  ["front", Eye, "Front"],
                  ["top", Grid2X2, "Plan"],
                  ["world", Maximize2, "World"],
                ] as const
              ).map(([value, Icon, label]) => (
                <button
                  key={value}
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <button
              className="ws-pause"
              aria-label={
                paused ? "Resume avatar animation" : "Pause avatar animation"
              }
              aria-pressed={paused}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          </div>
          <div className="ws-camera-hint">
            Drag to orbit · right-drag to pan the world · scroll to zoom
          </div>
        </section>
        <aside
          className="ws-collaborator car-collaborator"
          aria-label="Car design collaborator"
        >
          <div className="ws-collaborator-heading">
            <div className="ws-avatar-icon">
              <Box size={22} />
              <span />
            </div>
            <div>
              <h2>Muse</h2>
              <p>Your car-design collaborator</p>
            </div>
            <span className="ws-presence" />
          </div>
          <div className="ws-mode">
            <label htmlFor="car-mode">Editing with</label>
            <div>
              <select
                id="car-mode"
                value={mode}
                disabled={busy}
                onChange={(e) => {
                  setMode(e.target.value as "local" | "meta");
                  setError("");
                }}
              >
                <option value="local">Local commands · no AI</option>
                <option value="meta" disabled={!ready}>
                  Meta · Muse Spark{!ready ? " (needs API key)" : ""}
                </option>
              </select>
              <ChevronDown size={13} />
            </div>
          </div>
          {!ready && (
            <p className="ws-api-note">
              AI requires MODEL_API_KEY in web/.env.local and a server restart.
              All design controls work locally.
            </p>
          )}
          <div
            ref={log}
            className="ws-messages"
            role="log"
            aria-label="Car design conversation"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map((m, i) => (
              <div key={i} className={`ws-message ws-message-${m.role}`}>
                {m.role === "assistant" && (
                  <span className="ws-message-author">
                    <Sparkles size={13} />
                    Muse
                  </span>
                )}
                <p>{m.text}</p>
                {m.source && (
                  <span className="ws-message-source">{m.source}</span>
                )}
              </div>
            ))}
            {busy && (
              <div className="ws-thinking">
                <LoaderCircle size={15} className="ws-spin" />
                Creating geometry and checking your design…
              </div>
            )}
          </div>
          <div className="ws-chat-bottom">
            {!busy && (
              <div className="ws-suggestions">
                {(car
                  ? mode === "meta"
                    ? [
                        "Create a custom cooling duct",
                        "Design a new motor housing",
                        "Increase battery capacity",
                      ]
                    : ["Width 2.1", "Add a spoiler", "Make it blue"]
                  : ["Create a coupe", "Create an SUV"]
                ).map((text) => (
                  <button
                    key={text}
                    onClick={() => void submit(undefined, text)}
                  >
                    {text}
                    <ArrowUpRight size={12} />
                  </button>
                ))}
              </div>
            )}
            <div className="ws-selection-context">
              <CarFront size={13} />
              {car
                ? `Editing your ${car.style === "suv" ? "SUV" : car.style}`
                : "Describe the car you want to create"}
            </div>
            <form className="ws-command" onSubmit={submit}>
              <label className="visually-hidden" htmlFor="car-command">
                Describe your car design
              </label>
              <textarea
                id="car-command"
                rows={3}
                maxLength={2000}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  mode === "meta"
                    ? "Describe a new part, assembly or engineering change…"
                    : "Try “create a coupe” or “width 2.1”…"
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit();
                  }
                }}
              />
              <div>
                <span>
                  {mode === "meta"
                    ? "Meta AI · dimensions checked in code"
                    : "Local commands · no AI"}
                </span>
                {busy ? (
                  <button
                    type="button"
                    className="ws-stop"
                    onClick={() => request.current?.abort()}
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    type="submit"
                    aria-label="Send car design command"
                    disabled={!prompt.trim()}
                  >
                    <ArrowUp size={18} />
                  </button>
                )}
              </div>
            </form>
            <p className="ws-chat-footnote">
              {mode === "meta"
                ? "Requests send your car configuration and text to Meta."
                : "Local mode uses a fixed parser, not AI."}
            </p>
          </div>
        </aside>
      </div>
      <footer className="ws-status">
        <div role="status">
          <Check size={12} />
          <span>{status}</span>
        </div>
        <span>
          Visual concept · dimensions are not manufacturing specifications
        </span>
        <a href="/studio">
          Back to market
          <ArrowUpRight size={12} />
        </a>
      </footer>
      {error && (
        <div className="ws-error" role="alert">
          <div>
            <strong>That change couldn’t be applied.</strong>
            <p>{error}</p>
          </div>
          <button
            className="ws-icon-button"
            aria-label="Dismiss car error"
            onClick={() => setError("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </main>
  );
}
