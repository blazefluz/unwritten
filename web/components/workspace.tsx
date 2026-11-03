"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, CheckCheck, ChevronRight, CircleHelp, Clock3, Compass, FileText, Film, FolderOpen, GraduationCap, History, Layers3, LoaderCircle, MessageSquare, Play, Plus, ScanLine, Upload, X } from "lucide-react";
import { time, Workflow, workflowSchema } from "@/lib/workflow";
import ReviewerAccess from "./reviewer-access";
import EvidenceTag from "./evidence-tag";
import DecisionTest from "./decision-test";
import TrainingStudio from "./training-studio";
import { TrainingProject, TrainingSession } from "@/lib/training";

type View = "start" | "guide" | "review" | "references" | "history" | "questions" | "decisions" | "new";
const groups: {label: string; items: {id: View; title: string; Icon: typeof ScanLine}[]}[] = [
  {label: "Analyze a video", items: [
    {id: "review", title: "Review", Icon: ScanLine},
    {id: "questions", title: "Expert questions", Icon: MessageSquare},
    {id: "references", title: "References", Icon: FileText},
    {id: "history", title: "Revision history", Icon: History},
  ]},
  {label: "Teach and test", items: [
    {id: "guide", title: "Training guide", Icon: GraduationCap},
    {id: "decisions", title: "Decision test", Icon: CheckCheck},
  ]},
];
const titles: Record<View, string> = {start: "Overview", new: "New analysis", ...Object.fromEntries(groups.flatMap(g => g.items.map(i => [i.id, i.title])))} as Record<View, string>;
const groupOf = (view: View) => groups.find(g => g.items.some(i => i.id === view))?.label;
const steps: {label: string; text: string; view: View}[] = [
  {label: "Observe", text: "Muse Spark logs observed actions with video timestamps.", view: "review"},
  {label: "Infer", text: "It proposes the principle behind a decision, marked as inference.", view: "review"},
  {label: "Ask", text: "Questions surface uncertainty for expert review.", view: "questions"},
  {label: "Freeze", text: "A reviewer records a guide and its predictions before seeing answers.", view: "guide"},
  {label: "Validate", text: "Code scores the frozen predictions on reserved cases.", view: "guide"},
];
const viewKey = "unwritten-view-v1";
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type: "application/json"}));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Workspace({initial, guideExamples, demoOnly=false}: {demoOnly?:boolean;initial: Workflow; guideExamples:{cableProject:TrainingProject;syntheticSession:TrainingSession;cableSession:TrainingSession}}) {
  const [data, setData] = useState(initial);
  const [view, setView] = useState<View>("start");
  const [navTick, setNavTick] = useState(0);
  const [selected, setSelected] = useState(0);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoName, setVideoName] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [taskVideo, setTaskVideo] = useState<File | null>(null);
  const [task, setTask] = useState("");
  const [transcript, setTranscript] = useState<File | null>(null);
  const [scope, setScope] = useState("");
  const [references, setReferences] = useState<File[]>([]);
  const [previewOnly, setPreviewOnly] = useState(false);
  const [restored, setRestored] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const focusTarget = useRef<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const attachInput = useRef<HTMLInputElement>(null);
  const synthetic = /synthetic/i.test(data.task + data.source);
  const zipper = data.source === "k_YyHODQ-oI.mp4";
  const title = zipper ? "Three zipper repairs, one inferred rule" : synthetic ? data.task.replace(/^SYNTHETIC OFFLINE DEMO\s*[—–-]\s*/i, "") : data.task;
  const index = Math.min(selected, data.events.length - 1);
  const event = data.events[index];
  const questions = data.final.hypotheses.filter(h => h.expert_question.trim());
  const open = questions.filter(h => !answers[h.expert_question]?.trim()).length;
  const linked = event ? data.final.hypotheses.filter(h => h.event_ids.includes(event.id)) : [];
  const linkCount = (id: string) => data.final.hypotheses.filter(h => h.event_ids.includes(id)).length;
  const validCitations = data.final.reviews.flatMap(r => r.citations).filter(c => c.valid).length;
  const span = Math.max(duration, ...data.events.map(e => e.time_end), 1);
  const analysisView = view === "review" || view === "references" || view === "history" || view === "questions";
  const initialSynthetic = /synthetic/i.test(initial.task + initial.source);
  useEffect(() => { fetch("/api/status").then(r => r.json()).then(v => setReady(v.ready)).catch(() => {}); }, []);
  useEffect(() => { if (view !== "review") setPlaying(false); }, [view]);
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);
  useEffect(() => {
    let saved = false;
    try {
      const raw = localStorage.getItem("unwritten-workspace-v1");
      if (raw) {
        const parsed = workflowSchema.parse(JSON.parse(raw).workflow);
        setData(parsed); setAnswers(parsed.expert_answers); saved = true;
      }
    } catch {setError("The saved workspace could not be restored. Open an exported review to recover it.");}
    try {
      const last = localStorage.getItem(viewKey) as View | null;
      if (last && last in titles && last !== "new") setView(last); else if (saved) setView("review");
    } catch {}
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {localStorage.setItem("unwritten-workspace-v1", JSON.stringify({workflow: {...data, expert_answers: answers}}));}
    catch {setError("Browser storage is unavailable or full. Export your review and answers to save your work.");}
  }, [data, answers, restored]);
  useEffect(() => { if (restored) try {localStorage.setItem(viewKey, view);} catch {} }, [view, restored]);
  useEffect(() => {
    if (restored && zipper && !videoUrl) {
      setVideoUrl("/demo/zipper.mp4"); setVideoName("Clothes Doctor · zipper repairs");
    }
  }, [restored, zipper, videoUrl]);
  // Move focus to the new page heading (or a requested field) after navigation, so screen readers hear the change.
  useEffect(() => {
    const target = focusTarget.current; if (!target) return; focusTarget.current = null;
    requestAnimationFrame(() => {
      const field = target === "heading" ? null : document.getElementById(target);
      if (field) {field.scrollIntoView({block: "center"}); field.focus({preventScroll: true}); return;}
      const main = document.getElementById("workspace");
      const heading = Array.from(main?.querySelectorAll<HTMLElement>("h1") || []).find(h => h.offsetParent !== null) || main;
      window.scrollTo({top: 0});
      heading?.setAttribute("tabindex", "-1"); heading?.focus({preventScroll: true});
    });
  }, [navTick]);
  function go(next: View, focus = "heading") {
    setView(next); focusTarget.current = focus; setNavTick(t => t + 1);
  }
  function loadDemo() {
    setData(initial); setSelected(0); setAnswers(initial.expert_answers); setVideoUrl("/demo/zipper.mp4");
    setVideoName("Clothes Doctor · zipper repairs"); go("review"); setError(""); setPreviewOnly(false); setCurrentTime(0);
  }
  async function reviewAnswers() {
    setReviewing(true); setError("");
    try {
      const response = await fetch("/api/review", {method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({workflow: data, answers})});
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setData(workflowSchema.parse(payload)); go("history");
    } catch (err) {setError(err instanceof Error ? err.message : "Review failed. Your answers are preserved.");}
    finally {setReviewing(false);}
  }
  function attach(file: File, onlyPreview: boolean) {
    if (!/\.mp4$/i.test(file.name)) {setError("Choose an MP4 video."); return;}
    setVideoUrl(URL.createObjectURL(file)); setVideoName(file.name); setPlaying(false); setCurrentTime(0); setDuration(0); setPreviewOnly(onlyPreview);
  }
  function pick(next: number) {
    setSelected(next);
    if (video.current && videoUrl) video.current.currentTime = data.events[next].time_start;
  }
  // Keep the selected row visible inside the rail without scrolling the whole page.
  function revealRow(next: number) {
    const list = rail.current; const row = list?.querySelector<HTMLElement>(`[data-index="${next}"]`);
    if (!list || !row) return;
    if (row.offsetTop < list.scrollTop || row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = row.offsetTop - list.clientHeight / 3;
  }
  function step(delta: number) {
    const next = Math.max(0, Math.min(data.events.length - 1, index + delta)); pick(next); revealRow(next);
  }
  function railKey(e: KeyboardEvent<HTMLDivElement>) {
    const last = data.events.length - 1;
    const next = e.key === "ArrowDown" ? Math.min(last, index + 1) : e.key === "ArrowUp" ? Math.max(0, index - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
    if (next < 0) return;
    e.preventDefault(); pick(next); revealRow(next);
    rail.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus();
  }
  async function importReview(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error("size");
      const next = workflowSchema.parse(JSON.parse(await file.text()));
      setData(next); setSelected(0); setAnswers(next.expert_answers); setVideoUrl(""); setVideoName(""); setDuration(0); go("review"); setError("");
    } catch { setError("This file isn't a valid workflow review. Choose a .workflow.json exported by Unwritten (under 10 MB)."); }
  }
  async function analyze() {
    if (!taskVideo || !task.trim()) return;
    setBusy(true); setError("");
    try {
      const body = new FormData(); body.set("video", taskVideo); body.set("task", task); body.set("scope", scope);
      references.forEach(ref => body.append("references", ref));
      if (transcript) body.set("transcript", transcript);
      if(demoOnly&&taskVideo.size>25*1024*1024)throw new Error("Reviewer videos must be under 25 MB and two minutes.");
      const response = await fetch("/api/analyze", {method: "POST", body,headers:{"X-Analysis-Id":crypto.randomUUID()}});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Analysis failed.");
      const parsed = workflowSchema.parse(result);
      setData(parsed); setSelected(0); setAnswers(parsed.expert_answers); attach(taskVideo, false); go("review");
    } catch (err) { setError(err instanceof Error ? err.message : "Analysis failed. Please try again."); }
    finally { setBusy(false); if(demoOnly)window.dispatchEvent(new Event("unwritten:access-changed")); }
  }
  return <div className="app-shell">
    <a className="skip-link" href="#workspace">Skip to workspace</a>
    <aside className="sidebar">
      <a className="wordmark" href="/" aria-label="Unwritten home"><span className="brand-symbol"><span/><span/><span/></span>unwritten<span className="brand-period">.</span></a>
      <button className="new-button" onClick={() => {go("new"); setError("");}}><Plus size={17}/>New analysis</button>
      <button className="demo-link" onClick={loadDemo}><Play size={14}/>Watch repair demo</button>
      <nav aria-label="Workspace">
        <button className={view === "start" ? "nav-item active" : "nav-item"} aria-current={view === "start" ? "page" : undefined} onClick={() => go("start")}><Compass size={18}/>Overview</button>
        {groups.map(g => <div className="nav-group" key={g.label} role="group" aria-label={g.label}><span className="nav-heading" aria-hidden="true">{g.label}</span>{g.items.map(({id, title: label, Icon}) => <button key={id} className={view === id ? "nav-item active" : "nav-item"} aria-current={view === id ? "page" : undefined} onClick={() => go(id)}><Icon size={18}/>{label}{id === "questions" && open > 0 && <span className="nav-count" aria-label={`${open} open`}>{open}</span>}</button>)}</div>)}
      </nav>
      <div className="sidebar-section"><span className="sidebar-heading">Open review</span><button className="session-item" onClick={() => go("review")}><span className="session-dot"/><span>{title}</span></button><span className="session-caption">{synthetic ? "Synthetic example" : "Workflow analysis"}</span></div>
      <div className="sidebar-bottom"><div className="engine-mark"><Layers3 size={17}/><div>Powered by Meta<span>Muse Spark</span></div></div><p>Your observations.<br/>The reasoning behind them.</p></div>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <div className="breadcrumb">Workspace{groupOf(view) && <><ChevronRight size={14}/>{groupOf(view)}</>}<ChevronRight size={14}/><span>{titles[view]}</span></div>
        <div className="topbar-right">
          {analysisView && <span className="mode-chip">{synthetic ? <EvidenceTag kind="demo" label="Synthetic · scripted data"/> : <EvidenceTag kind="inferred" label="Model analysis · needs expert review"/>}</span>}
          <div className="header-actions" hidden={view === "guide" || view === "start"}><button className="button text-button" onClick={() => importInput.current?.click()}><FolderOpen size={16}/><span>Open review</span></button><button className="button" onClick={() => download({...data, expert_answers: answers}, "unwritten.workflow.json")}><ArrowDownToLine size={15}/><span>Export JSON</span></button></div>
        </div>
      </header>
      <input ref={importInput} type="file" accept=".json,application/json" className="visually-hidden" aria-label="Open workflow JSON" onChange={e => {void importReview(e.target.files?.[0]); e.target.value = "";}}/>
      <main id="workspace" tabIndex={-1}>
        {demoOnly && <div className="hosted-notice"><span className="badge">Public demo</span><p>Explore real Meta output and saved examples. Live video analysis requires a submission reviewer code; other server tools remain local-only.</p><a href="https://github.com/blazefluz/unwritten" target="_blank" rel="noreferrer">Run locally<ArrowRight size={14}/></a></div>}
        {demoOnly && <ReviewerAccess onReady={setReady}/>}
        {error && <div className="error-message" role="alert"><CircleHelp size={18}/><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError("")}><X size={17}/></button></div>}

        {view === "start" && <section className="start-view">
          <span className="eyebrow">Workflow review · training guides</span>
          <h1>Every expert has a way.<span>Learn it from the work, then test it.</span></h1>
          <p className="start-lede">Unwritten watches a video of someone working, separates what is visible from what a model infers, and asks the expert where the evidence is thin. Inferred rules stay tentative until reviewed.</p>
          <ol className="start-steps">{steps.map((s, i) => <li key={s.label}><button onClick={() => go(s.view)}><b>{String(i + 1).padStart(2, "0")}</b><strong>{s.label}</strong><span>{s.text}</span></button></li>)}</ol>
          <div className="start-key" aria-label="Evidence key"><span className="tiny-label">How evidence is marked</span><EvidenceTag kind="observed"/><EvidenceTag kind="testimony"/><EvidenceTag kind="inferred"/><EvidenceTag kind="attested"/><EvidenceTag kind="demo"/></div>
          <h2 className="start-subhead">Where to begin</h2>
          <div className="start-cards">
            <button className="start-card featured" onClick={loadDemo}><span className="start-card-icon"><ScanLine size={20}/></span><strong>{initialSynthetic ? "Explore the scripted example" : "Review the zipper repair analysis"}</strong><span>{initialSynthetic ? "A bundled review built from scripted data, for learning the interface offline." : "Meta Muse Spark's observations and inferred rule for a published Creative Commons repair video."}</span>{initialSynthetic ? <EvidenceTag kind="demo" label="Synthetic · scripted"/> : <EvidenceTag kind="inferred" label="Model output · not human-verified"/>}<span className="start-card-go">Open review<ArrowRight size={15}/></span></button>
            <button className="start-card" onClick={() => go("guide")}><span className="start-card-icon"><GraduationCap size={20}/></span><strong>Build a training guide</strong><span>Turn attributed cases into competing rules, ask the expert, freeze, then validate. Includes a published-video cable pilot and a scripted exercise.</span><span className="start-card-note">Bundled examples are not customer data</span><span className="start-card-go">Open guide<ArrowRight size={15}/></span></button>
            <button className="start-card" onClick={() => go("new")}><span className="start-card-icon"><Film size={20}/></span><strong>Analyze your own video</strong><span>Send an MP4 and optional reference excerpts to Meta Muse Spark for a new review.</span><span className="start-card-note">{demoOnly ? (ready?"Reviewer access unlocked":"Reviewer code required") : ready ? "Meta API connected" : "Requires a Meta API key"}</span><span className="start-card-go">Start<ArrowRight size={15}/></span></button>
            <button className="start-card" onClick={() => importInput.current?.click()}><span className="start-card-icon"><FolderOpen size={20}/></span><strong>Open a saved review</strong><span>Load a .workflow.json exported by Unwritten. It stays in this browser.</span><span className="start-card-note">Imported provenance is not independently verified</span><span className="start-card-go">Choose file<ArrowRight size={15}/></span></button>
          </div>
          <p className="start-continue">Open in this browser: <button onClick={() => go("review")}>{title}<ArrowRight size={14}/></button></p>
        </section>}

        {analysisView && <div className="page-heading"><div><span className="eyebrow">{synthetic ? "Synthetic example" : "Workflow analysis"}</span><div className="title-row"><h1>{title}</h1></div><p>{synthetic ? "This example uses scripted data. It is not a real video analysis." : "Source video → observed actions → tentative rules → expert review"}</p></div>{questions.length > 0 && <button className="review-state" onClick={() => go("questions")}><span/>{open ? `${open} of ${questions.length} expert ${questions.length === 1 ? "question" : "questions"} open` : "All expert questions have draft answers"}</button>}</div>}

        {view === "review" && event && <>
          <div className="review-summary" aria-label="Analysis summary">
            <div><strong>{data.events.length}</strong><span>Observed actions</span></div>
            <div><strong>{data.final.hypotheses.length}</strong><span>Tentative {data.final.hypotheses.length===1?"rule":"rules"}</span></div>
            <div><strong>{data.events.filter(e=>linkCount(e.id) > 0).length}/{data.events.length}</strong><span>Actions linked to a rule</span></div>
            <div><strong>{questions.length}</strong><span>Questions for an expert</span></div>
          </div>
          <div className="review-grid">
            <section className="timeline-rail" aria-labelledby="timeline-title">
              <div className="section-bar"><h2 id="timeline-title"><Clock3 size={17}/>Observed actions <span className="count">{data.events.length}</span></h2></div>
              <p className="rail-hint" id="timeline-hint">Use ↑ ↓ to move between actions.</p>
              <div className="event-list" ref={rail} role="listbox" aria-labelledby="timeline-title" aria-describedby="timeline-hint" onKeyDown={railKey}>
                {data.events.map((ev, i) => {const n = linkCount(ev.id); return <button key={ev.id} data-index={i} role="option" aria-selected={i === index} tabIndex={i === index ? 0 : -1} className={i === index ? "event-row selected" : "event-row"} onClick={() => pick(i)}>
                  <span className="event-time">{time(ev.time_start)}<span>{time(ev.time_end)}</span></span>
                  <span className="event-body"><strong>{ev.action}</strong><span>{ev.observed_result}</span></span>
                  {n > 0 && <span className="event-linked" title={`Linked to ${n} inferred ${n === 1 ? "principle" : "principles"}`}><span aria-hidden="true"/><span className="visually-hidden">Linked to {n} inferred {n === 1 ? "principle" : "principles"}</span></span>}
                </button>;})}
              </div>
            </section>

            <section className="evidence-column" aria-labelledby="video-title">
              <div className="section-bar"><h2 id="video-title"><Film size={17}/>Source video</h2><button className="small-button" onClick={() => attachInput.current?.click()}><Upload size={14}/>{videoUrl ? "Replace video" : "Attach video"}</button></div>
              <input ref={attachInput} className="visually-hidden" type="file" accept="video/mp4,.mp4" aria-label="Attach local preview video" onChange={e => {const f = e.target.files?.[0]; if (f) attach(f, true); e.target.value = "";}}/>
              <div className={videoUrl ? "video-stage has-video" : "video-stage"}>
                {videoUrl ? <video ref={video} src={videoUrl} controls onLoadedMetadata={e => {e.currentTarget.currentTime = currentTime; if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration);}} onTimeUpdate={e => {
                  const t = e.currentTarget.currentTime; setCurrentTime(t);
                  // Follow playback only while playing, so it never overrides a manual selection.
                  if (!e.currentTarget.paused) {const i = data.events.findIndex(ev => t >= ev.time_start && t < ev.time_end); if (i >= 0 && i !== index) {setSelected(i); revealRow(i);}}
                }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setError("This video couldn't be played. Choose another MP4 file.")}/> : <div className="video-empty"><div className="empty-film"><Film size={32} strokeWidth={1.25}/></div><h3>A closer look starts here.</h3><p>{synthetic ? "This synthetic example has no source video." : "Attach the original video to revisit each observation."}</p><button className="button" onClick={() => attachInput.current?.click()}><Plus size={15}/>Choose local video</button></div>}
              </div>
              <div className="event-strip" aria-hidden="true">
                {data.events.map((ev, i) => <button key={ev.id} tabIndex={-1} className={i === index ? "strip-mark selected" : "strip-mark"} style={{left: `${ev.time_start / span * 100}%`, width: `max(3px, ${(ev.time_end - ev.time_start) / span * 100}%)`}} title={`${time(ev.time_start)} · ${ev.action}`} onClick={() => {pick(i); revealRow(i);}}/>)}
                {videoUrl && <span className="strip-playhead" style={{left: `${Math.min(100, currentTime / span * 100)}%`}}/>}
              </div>
              <div className="video-footer"><span className="timestamp">{time(currentTime)}<span> / {time(span)}</span></span>{playing && <span className="following">Following playback</span>}<span className="source-name" title={videoName || data.source}>{videoName || "No video attached"}</span><span className="file-type">MP4</span></div>
              {zipper && <p className="video-attribution"><a href="https://www.youtube.com/watch?v=k_YyHODQ-oI" target="_blank" rel="noreferrer">Clothes Doctor × Zalando · How To Fix A Zip</a><br/><a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY</a> · clip 0–1:20, resized and compressed. No endorsement implied.</p>}
              {previewOnly && <p className="preview-note">Local playback only. Attach the matching source; recorded observations stay unchanged.</p>}

              <article className="observed-card" aria-labelledby="observed-title">
                <header className="observed-head">
                  <div><span className="tiny-label">Selected action {index + 1} of {data.events.length}</span><h2 id="observed-title">{event.action}</h2></div>
                  <div className="event-stepper"><button aria-label="Previous action" disabled={index === 0} onClick={() => step(-1)}><ArrowLeft size={16}/></button><span>{time(event.time_start)}–{time(event.time_end)}</span><button aria-label="Next action" disabled={index === data.events.length - 1} onClick={() => step(1)}><ArrowRight size={16}/></button></div>
                </header>
                <div className="evidence-block block-observed"><EvidenceTag kind="observed"/><h3 className="visually-hidden">What is visible</h3><p>{event.visible_evidence}</p><p className="observed-result"><span>Observed result</span>{event.observed_result}</p></div>
                {event.speaker_explanation && <div className="evidence-block block-testimony"><EvidenceTag kind="testimony"/><h3 className="visually-hidden">Speaker’s explanation</h3><p>{event.speaker_explanation}</p></div>}
                {event.uncertainties.length > 0 && <div className="uncertainty"><CircleHelp size={15}/><span><strong>Uncertain: </strong>{event.uncertainties.join(" ")}</span></div>}
                {videoUrl && <button className="small-button replay" onClick={() => {pick(index); void video.current?.play().catch(() => {});}}><Play size={14}/>Play from {time(event.time_start)}</button>}
              </article>
            </section>

            <section className="reasoning-column" aria-labelledby="reasoning-title">
              <div className="section-bar"><h2 id="reasoning-title"><ScanLine size={17}/>Behind the decision</h2><span className="count">{linked.length} {linked.length === 1 ? "principle" : "principles"}</span></div>
              <div className="reasoning-context"><span>Linked to action {index + 1}</span><span>{time(event.time_start)} — {time(event.time_end)}</span></div>
              {linked.length === 0 ? <div className="panel-empty"><CircleHelp size={26}/><h3>No principle linked yet</h3><p>This action has observations, but no inferred decision principle.</p></div> : linked.map(h => {
                const review = data.final.reviews.find(r => r.hypothesis_id === h.id);
                const exact = review?.citations.filter(c => c.valid).length || 0, unchecked = (review?.citations.length || 0) - exact;
                const long = h.reasoning.length > 240, full = !!expanded[h.id];
                const answered = !!answers[h.expert_question]?.trim();
                const qIndex = questions.findIndex(q => q.id === h.id);
                return <article className="principle" key={h.id}>
                  <div className="principle-heading"><EvidenceTag kind="inferred"/><span className={`badge ${review?.assessment || "inconclusive"}`}>{review?.assessment === "supported" ? <Check size={12}/> : <CircleHelp size={12}/>} Model assessment: {review?.assessment || "Not reviewed"}</span></div>
                  <h3>{h.claim}</h3>
                  {h.expert_question && <div className="expert-prompt"><MessageSquare size={17}/><div><strong>Ask the expert{answered && <span className="answered-flag"><Check size={12}/>Draft answer saved</span>}</strong><p>{h.expert_question}</p><button onClick={() => go("questions", `answer-${qIndex}`)}>{answered ? "Edit answer" : "Add an answer"} <ArrowRight size={14}/></button></div></div>}
                  <div className="evidence-block block-inferred"><span className="tiny-label">Why this rule was inferred</span><p id={`reasoning-${h.id}`} className={long && !full ? "reasoning-copy clamped" : "reasoning-copy"}>{h.reasoning}</p>{long && <button className="text-toggle" aria-expanded={full} aria-controls={`reasoning-${h.id}`} onClick={() => setExpanded({...expanded, [h.id]: !full})}>{full ? "Show less" : "Read full reasoning"}</button>}</div>
                  <div className="principle-details">
                    <details><summary><span>Alternative explanations</span><span className="detail-meta">{h.alternatives.length}</span></summary><ul>{h.alternatives.map((a,i) => <li key={i}>{a}</li>)}</ul></details>
                    <details><summary><span>Reference check</span><span className="detail-meta">{review?.citations.length ? [exact && `${exact} exact`, unchecked && `${unchecked} not validated`].filter(Boolean).join(" · ") : "No citations"}</span></summary>
                      <p className="check-explanation">{review?.explanation || "No assessment is available for this principle."}</p>
                      {review?.citations.map((c, i) => <div className="citation" key={i}><button onClick={() => go("references")}><FileText size={15}/><span>{data.references.find(r => r.id === c.reference_id)?.title || c.reference_id}</span><ArrowRight size={14}/></button><blockquote>“{c.quote}”</blockquote><div className="citation-meta"><span>Lines {c.line_start}–{c.line_end}</span><span>{c.valid ? <><CheckCheck size={13}/>Exact citation</> : "Citation could not be validated"}</span></div></div>)}
                    </details>
                    {review?.applicability && <details><summary><span>Applicability</span></summary><p>{review.applicability}</p></details>}
                  </div>
                  {!!review?.validation_errors.length && <div className="validation-errors">{review.validation_errors.join(" ")}</div>}
                </article>;
              })}
              <p className="review-footnote"><CircleHelp size={14}/>Model assessments need expert review. An exact citation confirms the source text, not the interpretation.</p>
            </section>
          </div>
          <footer className="workspace-footer"><span><CheckCheck size={14}/>{validCitations} exact {validCitations === 1 ? "citation" : "citations"} checked in code</span><span>{data.attempts.length} review {data.attempts.length === 1 ? "round" : "rounds"}<span className="footer-dot"/>{data.references.length} {data.references.length === 1 ? "reference" : "references"}</span></footer>
        </>}
        {view === "references" && <section className="document-view"><div className="section-bar"><h2>Supplied references</h2><span>{data.references.length} documents</span></div><p className="view-description">The exact excerpts used during review. Citation line numbers refer to these documents.</p>{data.transcript && <article className="reference-document"><h3>Narration: {data.transcript.source}</h3><p className="form-note">Supplied transcript; may contain errors. Speaker statements are testimony, not manufacturer evidence.</p><pre style={{whiteSpace:"pre-wrap"}}>{data.transcript.text}</pre></article>}{data.references.length ? data.references.map(ref => <article key={ref.id} className="reference-document"><div className="reference-title"><FileText size={23}/><div><h3>{ref.title}</h3><p>{ref.declared_scope || "Scope not specified"}</p></div><span className="badge">{ref.id}</span></div><div className="document-lines">{ref.lines.map((line,i) => <div key={i}><span>{i+1}</span><p>{line || " "}</p></div>)}</div><details className="document-hash"><summary>Document fingerprint</summary><code>{ref.sha256}</code></details></article>) : <div className="panel-empty"><FileText size={28}/><h3>No references supplied</h3><p>Start a new analysis with applicable text or Markdown excerpts to check the hypotheses.</p></div>}</section>}
        {view === "history" && <section className="document-view"><div className="section-bar"><h2>How the reasoning changed</h2><span>{data.attempts.length} rounds</span></div><p className="view-description">Earlier interpretations remain in the record, including conflicts and citation failures.</p>{data.attempts.map((attempt,i) => <article className="history-round" key={i}><div className="round-number">{String(i+1).padStart(2,"0")}</div><div><h3>Review round {i+1}{i === data.attempts.length - 1 && <span className="badge">Latest</span>}</h3>{attempt.hypotheses.map(h => {const r = attempt.reviews.find(r => r.hypothesis_id === h.id); return <div className="history-claim" key={h.id}><h4>{h.claim}</h4><span className={`badge ${r?.assessment || "inconclusive"}`}>Model assessment: {r?.assessment || "Not reviewed"}</span><p>{h.reasoning}</p><p>{r?.explanation}</p>{r?.validation_errors.map((error,index) => <p className="validation-errors" key={index}>{error}</p>)}</div>;})}</div></article>)}</section>}
        {view === "questions" && <section className="document-view"><div className="section-bar"><h2>The parts only an expert can explain</h2><button className="button" disabled={!Object.values(answers).some(a => a.trim())} onClick={() => download(Object.fromEntries(Object.entries(answers).filter(([,v]) => v.trim())), "expert-answers.json")}><ArrowDownToLine size={15}/>Export answers</button></div><p className="view-description">Your answers are testimony and are saved in this browser. Re-review with Meta to update the hypotheses while keeping earlier rounds in history.</p><div className="decision-actions"><button className="button primary-button" disabled={demoOnly || !ready || reviewing || !Object.values(answers).some(a => a.trim())} onClick={() => void reviewAnswers()}>{reviewing ? "Reviewing answers…" : "Re-review with Meta"}</button>{!ready && <span className="form-note">{demoOnly ? "Re-review is disabled in this public demo. You can save and export answers now." : "Meta API setup is pending. You can save and export answers now."}</span>}</div>{questions.length ? questions.map((h,i) => {const answered = !!answers[h.expert_question]?.trim(); return <div className="question-block" key={h.id} data-answered={answered}><span className="question-index">{answered ? <Check size={16} aria-label="Answered"/> : String(i+1).padStart(2,"0")}</span><div><h3>{h.expert_question}</h3><p className="question-about"><EvidenceTag kind="inferred" label="About the inferred rule"/>{h.claim}</p><label className="visually-hidden" htmlFor={`answer-${i}`}>Answer to {h.expert_question}</label><textarea id={`answer-${i}`} placeholder="Share the evidence or context behind this decision…" disabled={reviewing} maxLength={8000} value={answers[h.expert_question] || ""} onChange={e => setAnswers({...answers, [h.expert_question]: e.target.value})}/>{answered && <span className="answer-tag"><EvidenceTag kind="testimony" label="Your answer · testimony"/></span>}</div></div>;}) : <div className="panel-empty"><MessageSquare size={28}/><h3>No expert questions</h3><p>This analysis did not return any questions.</p></div>}</section>}
        {view === "new" && <section className="new-analysis"><button className="back-link" onClick={() => go("start")}><ArrowLeft size={15}/>Back to overview</button><span className="eyebrow">New analysis</span><h1>Analyze a work video.</h1><p className="new-intro">Watch their work. Uncover the decisions.<br/>Check the reasoning against what you know.</p><form onSubmit={e => {e.preventDefault(); void analyze();}}><fieldset disabled={busy}><label className="field-label" htmlFor="task">What are we observing?</label><textarea id="task" required maxLength={8000} placeholder="Describe the task, equipment, situation, and intended outcome." value={task} onChange={e => setTask(e.target.value)}/><div className="upload-fields"><label className="upload-area"><Film size={25}/><strong>{taskVideo?.name || "Add a work video"}</strong><span>{demoOnly?"MP4 · up to 25 MB · 2 minutes":"MP4 · up to 100 MB"}</span><input type="file" accept="video/mp4,.mp4" required onChange={e => setTaskVideo(e.target.files?.[0] || null)}/></label><label className="upload-area"><FileText size={25}/><strong>{references.length ? `${references.length} references selected` : "Add reference excerpts"}</strong><span>TXT or Markdown · optional</span><input type="file" accept=".txt,.md" multiple onChange={e => setReferences(Array.from(e.target.files || []))}/></label></div><label className="field-label" htmlFor="transcript">Narration transcript <span>Optional</span></label><input id="transcript" type="file" accept=".txt,.md" onChange={e => setTranscript(e.target.files?.[0] || null)}/><p className="form-note">Timestamped captions help distinguish visible actions from the speaker’s explanation. Use times relative to this clip and label automatic captions.</p><label className="field-label" htmlFor="scope">Reference applicability <span>Optional</span></label><input id="scope" className="text-input" maxLength={8000} placeholder="Document title, issuer, equipment model, and edition" value={scope} onChange={e => setScope(e.target.value)}/><p className="form-note">Video and references are sent to Meta when you start. Use material you have permission to share.</p>{!ready && <div className="api-notice"><CircleHelp size={18}/>{demoOnly ? <p><strong>Reviewer code required</strong><br/>Enter the code supplied with the submission above to unlock live video analysis. Saved examples are available without a code.</p> : <p><strong>Meta API setup is needed</strong><br/>Add MODEL_API_KEY to web/.env.local and restart the app. You can open a saved review while API access is pending.</p>}</div>}<button className="button primary-button start-analysis" disabled={!ready || !taskVideo || !task.trim()}>{busy ? <><LoaderCircle className="spin" size={17}/>Analyzing with Muse Spark…</> : <>Start analysis<ArrowRight size={17}/></>}</button>{busy && <p className="form-note" role="status">Watching the video and reviewing evidence. This can take several minutes. Keep this page open.</p>}</fieldset></form></section>}
        <div hidden={view !== "decisions"}><DecisionTest workflow={data} ready={!demoOnly&&ready}/></div>
        <div hidden={view !== "guide"}><TrainingStudio demoOnly={demoOnly} workflow={data} ready={!demoOnly&&ready} {...guideExamples}/></div>
      </main>
    </div>
  </div>;
}
