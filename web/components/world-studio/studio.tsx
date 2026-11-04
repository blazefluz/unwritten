"use client";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Box,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  Eye,
  Grid2X2,
  Layers3,
  LoaderCircle,
  Maximize2,
  Moon,
  Move,
  Pause,
  Play,
  Plus,
  RotateCw,
  Sparkles,
  Sun,
  Trash2,
  Undo2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import {
  CATALOG,
  EMPTY_WORLD,
  applyProposal,
  findSpace,
  inspectScene,
  kinds,
  localCommand,
  makeObject,
  marketWorld,
  proposalSchema,
  repairPlacement,
  sceneSchema,
  type Kind,
  type Proposal,
  type SceneObject,
  type World,
} from "@/lib/studio/scene";
import type { ViewMode } from "./viewport";
const Viewport = dynamic(() => import("./viewport"), {
  ssr: false,
  loading: () => (
    <div className="ws-scene-loading">
      <LoaderCircle className="ws-spin" size={24} />
      <span>Opening your studio…</span>
    </div>
  ),
});
type Message = {
  role: "user" | "assistant" | "system";
  text: string;
  source?: string;
};
type Pending = {
  world: World;
  ids: string[];
  issues: string[];
  message: string;
  source: string;
};
const STORAGE = "world-studio.scene.v1";
const initialMessage: Message = {
  role: "assistant",
  text: "Let’s make a space together. Start with an empty room, or explore the maker’s market example. Select anything to change it.",
  source: "Studio welcome",
};
const iconFor: Record<Kind, typeof Box> = {
  table: Grid2X2,
  shelf: Layers3,
  chair: UserRound,
  stool: UserRound,
  plant: Sparkles,
  lamp: Sun,
  counter: Box,
  partition: Layers3,
  crate: Box,
  rug: Grid2X2,
};
export default function WorldStudio() {
  const [world, setWorld] = useState<World>(EMPTY_WORLD),
    [history, setHistory] = useState<World[]>([]);
  const [selectedId, setSelected] = useState<string | null>(null),
    [view, setView] = useState<ViewMode>("orbit");
  const [messages, setMessages] = useState<Message[]>([initialMessage]),
    [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false),
    [mode, setMode] = useState<"local" | "meta">("local");
  const [ready, setReady] = useState<boolean | null>(null),
    [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [help, setHelp] = useState(false),
    [paused, setPaused] = useState(false);
  const [loaded, setLoaded] = useState(false),
    [panel, setPanel] = useState<"objects" | "chat">("chat");
  const log = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null),
    upload = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null),
    revision = useRef(0),
    currentWorld = useRef(world);
  const selected = world.objects.find((o) => o.id === selectedId);
  currentWorld.current = world;
  const addMessage = useCallback(
    (message: Message) => setMessages((old) => [...old.slice(-39), message]),
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/studio", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        setReady(Boolean(data.ready));
        if (data.ready) setMode("meta");
      })
      .catch(() => setReady(false));
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved) {
        const result = sceneSchema.safeParse(JSON.parse(saved));
        if (result.success && !inspectScene(result.data).length) {
          setWorld(result.data);
          setNotice("Restored your saved space.");
        } else
          setError(
            "The browser draft was invalid. Import a scene backup or start a new space.",
          );
      }
    } catch {
      setNotice(
        "Browser storage is unavailable. Export your scene to keep it.",
      );
    }
    setLoaded(true);
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify(world));
    } catch {
      setNotice(
        "Browser storage is full or unavailable. Export your scene to keep it.",
      );
    }
  }, [world, loaded]);
  useEffect(() => {
    log.current?.scrollTo({
      top: log.current.scrollHeight,
      behavior: "instant",
    });
  }, [messages, busy]);
  function commit(next: World, label?: string) {
    setHistory((old) => [...old.slice(-29), currentWorld.current]);
    setWorld(next);
    revision.current += 1;
    setPending(null);
    setError("");
    setNotice(label || "Scene updated. Saved in this browser.");
    if (selectedId && !next.objects.some((o) => o.id === selectedId))
      setSelected(null);
  }
  function propose(proposal: Proposal, source: string) {
    const next = applyProposal(currentWorld.current, proposal);
    const changed = proposal.actions.flatMap((a) =>
      a.type === "add" || a.type === "update" ? [a.object.id] : [],
    );
    const issues = inspectScene(next);
    if (issues.length) {
      setPending({
        world: next,
        ids: changed,
        issues: issues.map((i) => i.message),
        message: proposal.message,
        source,
      });
      addMessage({
        role: "assistant",
        text: `${proposal.message}\nThe proposed layout has ${issues.length} placement ${issues.length === 1 ? "conflict" : "conflicts"}. I’ve left your space unchanged.`,
        source,
      });
      return;
    }
    if (proposal.actions.length) {
      commit(next);
      if (changed.length) setSelected(changed[changed.length - 1]);
    }
    addMessage({ role: "assistant", text: proposal.message, source });
  }
  function manual(object: SceneObject) {
    try {
      propose(
        {
          message: `Updated ${object.label}.`,
          actions: [{ type: "update", object }],
        },
        "Local edit",
      );
    } catch {
      setError(
        "That edit is outside the supported range. Positions must remain within the room.",
      );
    }
  }
  function add(kind: Kind) {
    if (busy || pending) return;
    if (world.objects.length >= 40) {
      setError(
        "This prototype supports up to 40 objects. Remove one before adding another.",
      );
      return;
    }
    const object = findSpace(world, makeObject(kind));
    if (!object) {
      setError(
        "No clear floor space was found. Shrink or remove an object first.",
      );
      return;
    }
    propose(
      {
        message: `Added ${CATALOG[kind].name.toLowerCase()}. Select it to change its placement.`,
        actions: [{ type: "add", object }],
      },
      "Local catalog",
    );
  }
  async function submit(event?: FormEvent, supplied?: string) {
    event?.preventDefault();
    const text = (supplied || prompt).trim();
    if (!text || busy || pending) return;
    setError("");
    setPrompt("");
    addMessage({ role: "user", text });
    if (mode === "local") {
      try {
        propose(localCommand(world, text, selectedId), "Local command · no AI");
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "This local command could not run.",
        );
        setPrompt(text);
      }
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    const atRevision = revision.current;
    setBusy(true);
    const timer = setTimeout(() => controller.abort(), 230000);
    try {
      const response = await fetch("/api/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, scene: world, selectedId }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Meta could not finish this edit.");
      if (revision.current !== atRevision)
        throw new Error(
          "The scene changed while Meta was working. Send the request again for the current scene.",
        );
      propose(proposalSchema.parse(data), "Meta · Muse Spark");
    } catch (e) {
      setPrompt(text);
      setError(
        controller.signal.aborted
          ? "Request stopped. Your scene is unchanged. You can retry or switch to Local mode. A submitted Meta call may still finish on the server."
          : e instanceof Error
            ? e.message
            : "Could not apply this edit. Try a simpler request.",
      );
    } finally {
      clearTimeout(timer);
      setBusy(false);
      request.current = null;
    }
  }
  function undo() {
    if (!history.length || busy) return;
    const previous = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setWorld(previous);
    revision.current += 1;
    setPending(null);
    setSelected(null);
    setError("");
    setNotice("Undid the last scene change.");
  }
  function load(next: World, label: string) {
    if (busy) return;
    commit(next, label);
    setSelected(null);
    addMessage({ role: "system", text: label });
  }
  function exportScene() {
    const blob = new Blob([JSON.stringify(world, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${world.name.replace(/[^a-zA-Z0-9_-]/g, "-") || "world"}.world.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Scene exported. Import this file to reopen it.");
  }
  async function importScene(file?: File) {
    if (!file) return;
    try {
      if (file.size > 100000)
        throw new Error("Choose a scene JSON smaller than 100 KB.");
      const next = sceneSchema.parse(JSON.parse(await file.text()));
      if (inspectScene(next).length)
        throw new Error(
          "This scene has overlapping or out-of-bounds objects. Correct the source file before importing it.",
        );
      load(next, "Imported scene. Undo is available.");
    } catch (e) {
      setError(
        e instanceof Error && !("issues" in e)
          ? e.message
          : "That file is not a valid World Studio scene. Your space is unchanged.",
      );
    }
    if (upload.current) upload.current.value = "";
  }
  const issueIds = pending
    ? inspectScene(pending.world).flatMap((i) => i.ids)
    : [];
  const locked = busy || Boolean(pending);
  return (
    <main className="ws-app">
      <a className="ws-skip" href="#ws-command">
        Skip to studio command
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
        <div className="ws-project">
          <span className="ws-divider" />
          <label className="visually-hidden" htmlFor="ws-name">
            Scene name
          </label>
          <input
            id="ws-name"
            aria-label="Scene name"
            value={world.name}
            maxLength={100}
            disabled={locked}
            onChange={(e) => {
              setWorld({ ...world, name: e.target.value });
              revision.current += 1;
            }}
            onBlur={() => {
              if (!world.name.trim())
                setWorld({ ...world, name: "Untitled space" });
            }}
          />
          <span className="ws-prototype">Prototype</span>
        </div>
        <div className="ws-header-actions">
          <button
            className="ws-icon-button"
            title="Undo last change"
            aria-label="Undo last change"
            disabled={!history.length || busy}
            onClick={undo}
          >
            <Undo2 size={18} />
          </button>
          <span className="ws-divider" />
          <button
            className="ws-text-button ws-import"
            disabled={locked}
            onClick={() => upload.current?.click()}
          >
            <Upload size={16} />
            Import
          </button>
          <button className="ws-export" onClick={exportScene}>
            <Download size={15} />
            <span>Export scene</span>
          </button>
          <button
            className="ws-icon-button"
            aria-label="Studio help"
            title="Studio help"
            onClick={() => setHelp(!help)}
            aria-expanded={help}
          >
            <CircleHelp size={19} />
          </button>
        </div>
        <input
          ref={upload}
          className="visually-hidden"
          type="file"
          accept=".json,application/json"
          aria-label="Import scene JSON"
          disabled={locked}
          onChange={(e) => void importScene(e.target.files?.[0])}
        />
      </header>
      <div className="ws-mobile-switch">
        <button
          aria-pressed={panel === "objects"}
          onClick={() => setPanel("objects")}
        >
          <Layers3 size={16} />
          Objects
        </button>
        <button
          aria-pressed={panel === "chat"}
          onClick={() => setPanel("chat")}
        >
          <Sparkles size={16} />
          Collaborator
        </button>
      </div>
      <div className="ws-workspace" data-panel={panel}>
        <aside
          className="ws-library"
          aria-label="Object library and scene objects"
        >
          <div className="ws-library-title">
            <h2>Your space</h2>
            <span>
              {world.objects.length}
              <span className="ws-muted"> / 40</span>
            </span>
          </div>
          <div className="ws-scene-actions">
            <button
              disabled={locked}
              onClick={() =>
                load(
                  marketWorld(),
                  "Loaded the scripted maker’s market example. Undo is available.",
                )
              }
            >
              <Grid2X2 size={15} />
              Maker’s market
              <ArrowUpRight size={14} />
            </button>
            <button
              disabled={locked || !world.objects.length}
              onClick={() =>
                load(
                  { ...EMPTY_WORLD },
                  "Started an empty space. Undo is available.",
                )
              }
            >
              <Plus size={15} />
              Empty room
            </button>
          </div>
          <section className="ws-object-section">
            <div className="ws-section-heading">
              <h3>Objects</h3>
              <Layers3 size={14} />
            </div>
            {world.objects.length ? (
              <ul className="ws-object-list">
                {world.objects.map((o) => {
                  const Icon = iconFor[o.kind];
                  return (
                    <li key={o.id}>
                      <button
                        aria-pressed={selectedId === o.id}
                        onClick={() =>
                          setSelected(selectedId === o.id ? null : o.id)
                        }
                      >
                        <span
                          className="ws-object-swatch"
                          style={{ background: o.color }}
                        >
                          <Icon size={15} />
                        </span>
                        <span>{o.label}</span>
                        {selectedId === o.id && (
                          <span className="ws-selection-dot" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="ws-empty-list">
                <Box size={23} strokeWidth={1.3} />
                <p>A little room for possibility.</p>
                <span>
                  Add an object below or ask your collaborator to build a space.
                </span>
              </div>
            )}
          </section>
          <section className="ws-catalog">
            <div className="ws-section-heading">
              <h3>Add to your space</h3>
              <Plus size={14} />
            </div>
            <div className="ws-catalog-grid">
              {kinds.map((kind) => {
                const Icon = iconFor[kind];
                return (
                  <button
                    key={kind}
                    disabled={locked}
                    onClick={() => add(kind)}
                    title={CATALOG[kind].description}
                  >
                    <Icon size={19} strokeWidth={1.35} />
                    <span>{CATALOG[kind].name}</span>
                  </button>
                );
              })}
            </div>
          </section>
          <div className="ws-library-foot">
            <span className="ws-small-dot" />
            {loaded ? "Saved in this browser" : "Opening browser draft"}
            <span>12 × 10 m room</span>
          </div>
        </aside>
        <section className="ws-stage" aria-label="3D studio">
          <div className="ws-stage-heading">
            <div>
              <span className="ws-stage-tag">
                <span />
                {world.lighting === "day"
                  ? "Daylight studio"
                  : "Evening studio"}
              </span>
              <h1>
                {world.objects.length
                  ? "A space, taking shape."
                  : "What shall we build?"}
              </h1>
              <p>
                {world.objects.length
                  ? "Select an object. Make it yours."
                  : "An empty room. A collaborator. Your next idea."}
              </p>
            </div>
            <div className="ws-light-control">
              <button
                title="Daylight"
                aria-label="Daylight"
                aria-pressed={world.lighting === "day"}
                disabled={locked}
                onClick={() => commit({ ...world, lighting: "day" })}
              >
                <Sun size={17} />
              </button>
              <button
                title="Night lighting"
                aria-label="Night lighting"
                aria-pressed={world.lighting === "night"}
                disabled={locked}
                onClick={() => commit({ ...world, lighting: "night" })}
              >
                <Moon size={17} />
              </button>
            </div>
          </div>
          <Viewport
            world={world}
            selectedId={selectedId}
            preview={pending?.world || null}
            issueIds={issueIds}
            busy={busy}
            paused={paused}
            view={view}
            onSelect={setSelected}
          />
          <div className="ws-stage-note">
            <span className="ws-avatar-marker" />
            <span>
              {busy
                ? "Muse is considering your space…"
                : selected
                  ? `Muse is beside ${selected.label.toLowerCase()}`
                  : "Muse is here to build with you"}
            </span>
          </div>
          {!world.objects.length && (
            <div className="ws-start">
              <button
                disabled={locked}
                onClick={() =>
                  load(
                    marketWorld(),
                    "Loaded the scripted maker’s market example. Undo is available.",
                  )
                }
              >
                Explore a maker’s market
                <ArrowUpRight size={16} />
              </button>
              <span>Built-in example · editable, no AI call</span>
            </div>
          )}
          <div className="ws-viewport-tools">
            <div className="ws-views" aria-label="Camera view">
              {(
                [
                  ["orbit", Maximize2, "Orbit"],
                  ["top", Grid2X2, "Plan"],
                  ["walk", Eye, "Walk"],
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
              title={
                paused ? "Resume avatar animation" : "Pause avatar animation"
              }
              aria-pressed={paused}
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          </div>
          <div className="ws-camera-hint">
            {view === "walk"
              ? "Focus the scene · WASD / arrows to walk · drag to look"
              : view === "top"
                ? "Scroll to zoom · right-drag to pan"
                : "Drag to orbit · scroll to zoom · click to select"}
          </div>
          {pending && (
            <div className="ws-conflict" role="alert">
              <div>
                <Move size={20} />
                <strong>This needs a little more room.</strong>
              </div>
              <p>
                {pending.issues.slice(0, 3).join(" ")}
                {pending.issues.length > 3
                  ? ` And ${pending.issues.length - 3} more.`
                  : ""}
              </p>
              <span>
                Outlined objects are a preview. Your scene hasn’t changed.
              </span>
              <div className="ws-conflict-actions">
                <button
                  onClick={() => {
                    const fixed = repairPlacement(pending.world, pending.ids);
                    if (!fixed) {
                      setError(
                        "No clear placement was found. Discard this proposal and try smaller or fewer objects.",
                      );
                      return;
                    }
                    commit(fixed, "Placement repaired using footprint checks.");
                    addMessage({
                      role: "assistant",
                      text: "Found clear floor space for the proposed objects. Check the arrangement and undo if you prefer.",
                      source: "Local geometry check",
                    });
                  }}
                >
                  Find space
                  <ArrowRight size={15} />
                </button>
                <button
                  onClick={() => {
                    setPending(null);
                    setError("");
                    setNotice("Proposal discarded. Your space is unchanged.");
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
          )}
          {selected && !pending && (
            <div className="ws-inspector">
              <div className="ws-inspector-title">
                <div>
                  <span className="ws-selected-label">Selected object</span>
                  <strong>{selected.label}</strong>
                </div>
                <button
                  className="ws-icon-button"
                  aria-label="Clear selection"
                  onClick={() => setSelected(null)}
                >
                  <X size={15} />
                </button>
              </div>
              <div className="ws-inspector-dimensions">
                {(CATALOG[selected.kind].size[0] * selected.scale).toFixed(2)} ×{" "}
                {(CATALOG[selected.kind].size[2] * selected.scale).toFixed(2)} m
                footprint <span>· {selected.rotation}°</span>
              </div>
              <div className="ws-inspector-controls">
                <div className="ws-nudge">
                  <button
                    aria-label="Move back 0.5 metres"
                    title="Move back 0.5 m"
                    disabled={locked}
                    onClick={() => manual({ ...selected, z: selected.z - 0.5 })}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    aria-label="Move left 0.5 metres"
                    title="Move left 0.5 m"
                    disabled={locked}
                    onClick={() => manual({ ...selected, x: selected.x - 0.5 })}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <button
                    aria-label="Move forward 0.5 metres"
                    title="Move forward 0.5 m"
                    disabled={locked}
                    onClick={() => manual({ ...selected, z: selected.z + 0.5 })}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    aria-label="Move right 0.5 metres"
                    title="Move right 0.5 m"
                    disabled={locked}
                    onClick={() => manual({ ...selected, x: selected.x + 0.5 })}
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
                <button
                  className="ws-icon-button"
                  aria-label="Rotate selected object 90 degrees"
                  title="Rotate 90°"
                  disabled={locked}
                  onClick={() =>
                    manual({
                      ...selected,
                      rotation: ((selected.rotation + 90) %
                        360) as SceneObject["rotation"],
                    })
                  }
                >
                  <RotateCw size={17} />
                </button>
                <label className="ws-scale">
                  Size
                  <select
                    aria-label="Object scale"
                    disabled={locked}
                    value={selected.scale}
                    onChange={(e) =>
                      manual({ ...selected, scale: Number(e.target.value) })
                    }
                  >
                    {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((s) => (
                      <option key={s} value={s}>
                        {s}×
                      </option>
                    ))}
                    {![0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(
                      selected.scale,
                    ) && (
                      <option value={selected.scale}>{selected.scale}×</option>
                    )}
                  </select>
                </label>
                <label className="ws-color" title="Object color">
                  <span className="visually-hidden">Object color</span>
                  <input
                    type="color"
                    aria-label="Object color"
                    disabled={locked}
                    value={selected.color}
                    onChange={(e) =>
                      manual({ ...selected, color: e.target.value })
                    }
                  />
                </label>
                <button
                  className="ws-icon-button ws-delete"
                  aria-label="Delete selected object"
                  title="Delete object"
                  disabled={locked}
                  onClick={() =>
                    propose(
                      {
                        message: `Removed ${selected.label}. Undo is available.`,
                        actions: [{ type: "remove", id: selected.id }],
                      },
                      "Local edit",
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          )}
        </section>
        <aside className="ws-collaborator" aria-label="AI collaborator">
          <div className="ws-collaborator-heading">
            <div className="ws-avatar-icon">
              <Box size={22} strokeWidth={1.5} />
              <span />
            </div>
            <div>
              <h2>Muse</h2>
              <p>Your spatial collaborator</p>
            </div>
            <span className="ws-presence" title="Avatar present" />
          </div>
          <div className="ws-mode">
            <label htmlFor="ws-mode">Editing with</label>
            <div>
              <select
                id="ws-mode"
                value={mode}
                disabled={locked}
                onChange={(e) => {
                  setMode(e.target.value as "local" | "meta");
                  setError("");
                }}
              >
                <option value="local">Local commands · no AI</option>
                <option value="meta" disabled={!ready}>
                  Meta · Muse Spark{ready === false ? " (needs API key)" : ""}
                </option>
              </select>
              <ChevronDown size={13} />
            </div>
          </div>
          {ready === false && (
            <p className="ws-api-note">
              Meta AI needs a server API key. You can build with local commands
              now. <button onClick={() => setHelp(true)}>Setup</button>
            </p>
          )}
          <div
            className="ws-messages"
            ref={log}
            role="log"
            aria-label="Studio conversation"
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
                <LoaderCircle className="ws-spin" size={15} />
                <span>Considering your space…</span>
              </div>
            )}
          </div>
          <div className="ws-chat-bottom">
            {!busy && !pending && (
              <div className="ws-suggestions">
                {(world.objects.length
                  ? selected
                    ? ["Make this green", "Rotate this", "Add a lamp here"]
                    : ["Add a plant", "Make it nighttime"]
                  : [
                      mode === "meta"
                        ? "Build a maker’s market with a worktable and display area"
                        : "Build a maker’s market",
                    ]
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
              {selected ? (
                <>
                  <span className="ws-small-dot" />
                  Referring to <strong>{selected.label}</strong>
                </>
              ) : (
                <>
                  <Move size={12} />
                  Select an object to say “this”
                </>
              )}
            </div>
            <form className="ws-command" onSubmit={submit}>
              <label className="visually-hidden" htmlFor="ws-command">
                Describe a change to your space
              </label>
              <textarea
                id="ws-command"
                ref={input}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={2000}
                disabled={Boolean(pending)}
                rows={3}
                placeholder={
                  pending
                    ? "Resolve the placement preview first…"
                    : mode === "meta"
                      ? "Describe what you want to build…"
                      : "Try “add a table” or “make it nighttime”…"
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
                    ? "Meta AI · edits checked in code"
                    : "Local mode · limited commands"}
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
                    aria-label="Send studio command"
                    disabled={!prompt.trim() || Boolean(pending)}
                  >
                    <ArrowUp size={18} />
                  </button>
                )}
              </div>
            </form>
            <p className="ws-chat-footnote">
              {mode === "meta"
                ? "Requests send your scene and text to Meta."
                : "Local commands use a fixed parser, not AI."}
            </p>
          </div>
        </aside>
      </div>
      <footer className="ws-status">
        <div role="status">
          <Check size={12} />
          <span>{notice || "Your space is saved locally as you build."}</span>
        </div>
        <span>Geometry checks only · no structural simulation</span>
        <a href="/">
          Unwritten workspace
          <ArrowUpRight size={12} />
        </a>
      </footer>
      {error && (
        <div className="ws-error" role="alert">
          <div>
            <strong>Couldn’t complete that edit.</strong>
            <p>{error}</p>
          </div>
          <button
            className="ws-icon-button"
            aria-label="Dismiss error"
            onClick={() => setError("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {help && (
        <div className="ws-help" role="region" aria-label="Studio help">
          <div>
            <h2>Make yourself at home.</h2>
            <button
              className="ws-icon-button"
              aria-label="Close help"
              onClick={() => setHelp(false)}
            >
              <X size={18} />
            </button>
          </div>
          <p>
            Drag the scene to orbit, scroll to zoom, or select{" "}
            <strong>Walk</strong> and focus the canvas to move with WASD. Use
            the object list and inspector for keyboard editing.
          </p>
          <h3>Build together</h3>
          <p>
            Choose an object and refer to it as “this”. Meta can arrange objects
            from the ten-item catalog. Local mode supports adding, moving,
            rotating, resizing, colors and day/night.
          </p>
          <h3>Connect Meta AI</h3>
          <p>
            Set <code>MODEL_API_KEY</code> in <code>web/.env.local</code> and
            restart the development server. Meta requests use the server-side
            Python environment and Muse Spark. The key stays on the server.
          </p>
          <h3>What is checked?</h3>
          <p>
            Floor footprints, room bounds and overlapping objects. Rugs can sit
            under furniture. This prototype does not check physics,
            accessibility, load capacity or real-world safety. Avatar movement
            is a visual cue, not collision-aware navigation.
          </p>
          <p>
            Scenes are saved in this browser. Export JSON for a portable backup.
            Example layouts are scripted, not model output.
          </p>
        </div>
      )}
    </main>
  );
}
