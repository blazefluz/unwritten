"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowLeft, ArrowRight, BookOpen, Check, CheckCheck, ChevronRight, CircleHelp, Clock3, FileText, Film, FolderOpen, History, Layers3, LoaderCircle, MessageSquare, Pause, Play, Plus, ScanLine, Sparkles, Upload, X } from "lucide-react";
import { time, Workflow, workflowSchema } from "@/lib/workflow";
import DecisionTest from "./decision-test";

type View = "review" | "references" | "history" | "questions" | "decisions" | "new";
const navigation = [
  {id: "review" as View, title: "Review", Icon: ScanLine},
  {id: "references" as View, title: "References", Icon: BookOpen},
  {id: "history" as View, title: "Revision history", Icon: History},
  {id: "questions" as View, title: "Expert questions", Icon: MessageSquare},
  {id: "decisions" as View, title: "Decision test", Icon: CheckCheck},
];
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type: "application/json"}));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Workspace({initial}: {initial: Workflow}) {
  const [data, setData] = useState(initial);
  const [view, setView] = useState<View>("review");
  const [selected, setSelected] = useState(0);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoName, setVideoName] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
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
  const importInput = useRef<HTMLInputElement>(null);
  const attachInput = useRef<HTMLInputElement>(null);
  const synthetic = /synthetic/i.test(data.task + data.source);
  const title = synthetic ? data.task.replace(/^SYNTHETIC OFFLINE DEMO\s*[—–-]\s*/i, "") : data.task;
  const event = data.events[selected];
  const questions = data.final.hypotheses.filter(h => h.expert_question.trim());
  const linked = data.final.hypotheses.filter(h => h.event_ids.includes(event.id));
  const validCitations = data.final.reviews.flatMap(r => r.citations).filter(c => c.valid).length;
  useEffect(() => { fetch("/api/status").then(r => r.json()).then(v => setReady(v.ready)).catch(() => {}); }, []);
  useEffect(() => { if (view !== "review") setPlaying(false); }, [view]);
  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("unwritten-workspace-v1");
      if (raw) {
        const saved = JSON.parse(raw);
        const parsed = workflowSchema.parse(saved.workflow);
        setData(parsed); setAnswers(parsed.expert_answers);
      }
    } catch {setError("The saved workspace could not be restored. Open an exported review to recover it.");}
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {localStorage.setItem("unwritten-workspace-v1", JSON.stringify({workflow: {...data, expert_answers: answers}}));}
    catch {setError("Browser storage is unavailable or full. Export your review and answers to save your work.");}
  }, [data, answers, restored]);
  async function reviewAnswers() {
    setReviewing(true); setError("");
    try {
      const response = await fetch("/api/review", {method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({workflow: data, answers})});
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setData(workflowSchema.parse(payload)); setView("history");
    } catch (err) {setError(err instanceof Error ? err.message : "Review failed. Your answers are preserved.");}
    finally {setReviewing(false);}
  }
  function attach(file: File, onlyPreview: boolean) {
    if (!/\.mp4$/i.test(file.name)) {setError("Choose an MP4 video."); return;}
    setVideoUrl(URL.createObjectURL(file)); setVideoName(file.name); setPlaying(false); setCurrentTime(0); setPreviewOnly(onlyPreview);
  }
  function pick(index: number) {
    setSelected(index);
    if (video.current && videoUrl) video.current.currentTime = data.events[index].time_start;
  }
  async function importReview(file?: File) {
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error("size");
      const next = workflowSchema.parse(JSON.parse(await file.text()));
      setData(next); setSelected(0); setAnswers(next.expert_answers); setVideoUrl(""); setVideoName(""); setView("review"); setError("");
    } catch { setError("This file isn't a valid workflow review. Choose a .workflow.json exported by Unwritten (under 10 MB)."); }
  }
  async function analyze() {
    if (!taskVideo || !task.trim()) return;
    setBusy(true); setError("");
    try {
      const body = new FormData(); body.set("video", taskVideo); body.set("task", task); body.set("scope", scope);
      references.forEach(ref => body.append("references", ref));
      if (transcript) body.set("transcript", transcript);
      const response = await fetch("/api/analyze", {method: "POST", body});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Analysis failed.");
      const parsed = workflowSchema.parse(result);
      setData(parsed); setSelected(0); setAnswers(parsed.expert_answers); attach(taskVideo, false); setView("review");
    } catch (err) { setError(err instanceof Error ? err.message : "Analysis failed. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="app-shell">
    <a className="skip-link" href="#workspace">Skip to workspace</a>
    <aside className="sidebar">
      <a className="wordmark" href="/" aria-label="Unwritten home"><span className="brand-symbol"><span/><span/><span/></span>unwritten<span className="brand-period">.</span></a>
      <button className="new-button" onClick={() => {setView("new"); setError("");}}><Plus size={17}/>New analysis</button>
      <nav aria-label="Workspace">{navigation.map(({id, title: label, Icon}) => <button key={id} className={view === id ? "nav-item active" : "nav-item"} onClick={() => setView(id)}><Icon size={18}/>{label}{id === "questions" && <span className="nav-count">{questions.length}</span>}</button>)}</nav>
      <div className="sidebar-section"><span className="sidebar-heading">Open review</span><button className="session-item" onClick={() => setView("review")}><span className="session-dot"/><span>{title}</span></button><span className="session-caption">{synthetic ? "Synthetic example" : "Workflow analysis"}</span></div>
      <div className="sidebar-bottom"><div className="engine-mark"><Layers3 size={17}/><div>Powered by Meta<span>Muse Spark</span></div></div><p>Your observations.<br/>The reasoning behind them.</p></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb">Workspace<ChevronRight size={14}/><span>{view === "new" ? "New analysis" : navigation.find(n => n.id === view)?.title}</span></div><div className="header-actions"><button className="button text-button" onClick={() => importInput.current?.click()}><FolderOpen size={16}/><span>Open review</span></button><button className="button" onClick={() => download({...data, expert_answers: answers}, "unwritten.workflow.json")}><ArrowDownToLine size={15}/><span>Export JSON</span></button></div></header>
      <input ref={importInput} type="file" accept=".json,application/json" className="visually-hidden" aria-label="Open workflow JSON" onChange={e => {void importReview(e.target.files?.[0]); e.target.value = "";}}/>
      <main id="workspace" tabIndex={-1}>
        {error && <div className="error-message" role="alert"><CircleHelp size={18}/><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError("")}><X size={17}/></button></div>}
        {view !== "new" && view !== "decisions" && <><div className="page-heading"><div><div className="title-row"><h1>{title}</h1>{synthetic && <span className="badge sample">Synthetic example</span>}</div><p>Understand the decisions. Follow the evidence.</p></div><span className="review-state"><span/>Ready for expert review</span></div>
        {synthetic && <div className="sample-notice"><Sparkles size={15}/><span>This example uses scripted data. It is not a real video analysis.</span></div>}</>}
        {view === "review" && <>
          <div className="review-grid">
            <section className="observation-column" aria-label="Source video and observed events">
              <div className="section-bar"><h2><Film size={17}/>Source video</h2><button className="small-button" onClick={() => attachInput.current?.click()}><Upload size={14}/>{videoUrl ? "Replace video" : "Attach video"}</button></div>
              <input ref={attachInput} className="visually-hidden" type="file" accept="video/mp4,.mp4" aria-label="Attach local preview video" onChange={e => {const f = e.target.files?.[0]; if (f) attach(f, true); e.target.value = "";}}/>
              <div className={videoUrl ? "video-stage has-video" : "video-stage"}>
                {videoUrl ? <video ref={video} src={videoUrl} controls onLoadedMetadata={e => {e.currentTarget.currentTime = currentTime;}} onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setError("This video couldn't be played. Choose another MP4 file.")}/> : <div className="video-empty"><div className="empty-film"><Film size={32} strokeWidth={1.25}/></div><h3>A closer look starts here.</h3><p>{synthetic ? "This synthetic example has no source video." : "Attach the original video to revisit each observation."}</p><button className="button" onClick={() => attachInput.current?.click()}><Plus size={15}/>Choose local video</button></div>}
              </div>
              <div className="video-footer"><div><button className="icon-button" disabled={!videoUrl} aria-label={playing ? "Pause video" : "Play video"} onClick={() => {if (video.current) {if (playing) video.current.pause(); else void video.current.play().catch(() => setError("Playback could not start. Use the video's play control."));}}}>{playing ? <Pause size={15}/> : <Play size={15}/>}</button><span className="timestamp">{time(currentTime)}</span></div><span className="source-name" title={videoName || data.source}>{videoName || "No video attached"}</span><span className="file-type">MP4</span></div>
              {previewOnly && <p className="preview-note">Local playback only. Attach the matching source; recorded observations stay unchanged.</p>}
              <div className="section-bar timeline-heading"><h2><Clock3 size={17}/>Observed actions <span className="count">{data.events.length}</span></h2><span className="subtle">Select an event to inspect</span></div>
              <div className="event-list">{data.events.map((ev, index) => <button key={ev.id} className={index === selected ? "event-row selected" : "event-row"} aria-pressed={index === selected} onClick={() => pick(index)}><span className="event-time">{time(ev.time_start)}<span>{time(ev.time_end)}</span></span><span className="event-body"><strong>{ev.action}</strong><span>{ev.observed_result}</span></span><ChevronRight size={16}/></button>)}</div>
              <div className="observed-evidence"><h3>What is visible</h3><p>{event.visible_evidence}</p>{event.speaker_explanation && <><h3>Speaker’s explanation · testimony</h3><p>{event.speaker_explanation}</p></>}{event.uncertainties.length > 0 && <div className="uncertainty"><CircleHelp size={15}/><span>{event.uncertainties.join(" ")}</span></div>}</div>
            </section>
            <section className="reasoning-column" aria-label="Reasoning for selected event">
              <div className="section-bar"><h2><ScanLine size={17}/>Behind the decision</h2><span className="count">{linked.length}</span></div>
              <div className="reasoning-context"><span className="tiny-label">Selected observation</span><span>{time(event.time_start)} — {time(event.time_end)}</span></div>
              {linked.length === 0 ? <div className="panel-empty"><CircleHelp size={26}/><h3>No principle linked yet</h3><p>This event has observations, but no inferred decision principle.</p></div> : linked.map(h => {
                const review = data.final.reviews.find(r => r.hypothesis_id === h.id);
                return <article className="principle" key={h.id}>
                  <div className="principle-heading"><span className="hypothesis-label">Inferred principle</span><span className={`badge ${review?.assessment || "inconclusive"}`}>{review?.assessment === "supported" ? <Check size={12}/> : <CircleHelp size={12}/>} Model assessment: {review?.assessment || "Not reviewed"}</span></div>
                  <h3>{h.claim}</h3><p className="reasoning-copy">{h.reasoning}</p>
                  <details className="alternatives"><summary>Alternative explanations <span>{h.alternatives.length}</span></summary><ul>{h.alternatives.map((a,i) => <li key={i}>{a}</li>)}</ul></details>
                  <div className="citation-heading"><BookOpen size={15}/><h4>Reference check</h4></div>
                  <p className="check-explanation">{review?.explanation || "No assessment is available for this principle."}</p>
                  {review?.citations.map((c, i) => <div className="citation" key={i}><button onClick={() => setView("references")}><FileText size={15}/><span>{data.references.find(r => r.id === c.reference_id)?.title || c.reference_id}</span><ArrowRight size={14}/></button><blockquote>“{c.quote}”</blockquote><div className="citation-meta"><span>Lines {c.line_start}–{c.line_end}</span><span>{c.valid ? <><CheckCheck size={13}/>Exact citation</> : "Citation could not be validated"}</span></div></div>)}
                  {review?.applicability && <details className="applicability"><summary>Applicability</summary><p>{review.applicability}</p></details>}
                  {!!review?.validation_errors.length && <div className="validation-errors">{review.validation_errors.join(" ")}</div>}
                  {h.expert_question && <div className="expert-prompt"><MessageSquare size={17}/><div><strong>Ask the expert</strong><p>{h.expert_question}</p><button onClick={() => setView("questions")}>Add an answer <ArrowRight size={14}/></button></div></div>}
                </article>;
              })}
              <p className="review-footnote"><CircleHelp size={14}/>Model assessments need expert review. An exact citation confirms the source text, not the interpretation.</p>
            </section>
          </div>
          <footer className="workspace-footer"><span><CheckCheck size={14}/>{validCitations} exact {validCitations === 1 ? "citation" : "citations"} checked in code</span><span>{data.attempts.length} review {data.attempts.length === 1 ? "round" : "rounds"}<span className="footer-dot"/>{data.references.length} {data.references.length === 1 ? "reference" : "references"}</span></footer>
        </>}
        {view === "references" && <section className="document-view"><div className="section-bar"><h2>Supplied references</h2><span>{data.references.length} documents</span></div><p className="view-description">The exact excerpts used during review. Citation line numbers refer to these documents.</p>{data.transcript && <article className="reference-document"><h3>Narration: {data.transcript.source}</h3><p className="form-note">Supplied transcript; may contain errors. Speaker statements are testimony, not manufacturer evidence.</p><pre style={{whiteSpace:"pre-wrap"}}>{data.transcript.text}</pre></article>}{data.references.length ? data.references.map(ref => <article key={ref.id} className="reference-document"><div className="reference-title"><FileText size={23}/><div><h3>{ref.title}</h3><p>{ref.declared_scope || "Scope not specified"}</p></div><span className="badge">{ref.id}</span></div><div className="document-lines">{ref.lines.map((line,i) => <div key={i}><span>{i+1}</span><p>{line || " "}</p></div>)}</div><details className="document-hash"><summary>Document fingerprint</summary><code>{ref.sha256}</code></details></article>) : <div className="panel-empty"><BookOpen size={28}/><h3>No references supplied</h3><p>Start a new analysis with applicable text or Markdown excerpts to check the hypotheses.</p></div>}</section>}
        {view === "history" && <section className="document-view"><div className="section-bar"><h2>How the reasoning changed</h2><span>{data.attempts.length} rounds</span></div><p className="view-description">Earlier interpretations remain in the record, including conflicts and citation failures.</p>{data.attempts.map((attempt,i) => <article className="history-round" key={i}><div className="round-number">{String(i+1).padStart(2,"0")}</div><div><h3>Review round {i+1}{i === data.attempts.length - 1 && <span className="badge">Latest</span>}</h3>{attempt.hypotheses.map(h => {const r = attempt.reviews.find(r => r.hypothesis_id === h.id); return <div className="history-claim" key={h.id}><h4>{h.claim}</h4><span className={`badge ${r?.assessment || "inconclusive"}`}>Model assessment: {r?.assessment || "Not reviewed"}</span><p>{h.reasoning}</p><p>{r?.explanation}</p>{r?.validation_errors.map((error,index) => <p className="validation-errors" key={index}>{error}</p>)}</div>;})}</div></article>)}</section>}
        {view === "questions" && <section className="document-view"><div className="section-bar"><h2>The parts only an expert can explain</h2><button className="button" disabled={!Object.values(answers).some(a => a.trim())} onClick={() => download(Object.fromEntries(Object.entries(answers).filter(([,v]) => v.trim())), "expert-answers.json")}><ArrowDownToLine size={15}/>Export answers</button></div><p className="view-description">Your answers are testimony and are saved in this browser. Re-review with Meta to update the hypotheses while keeping earlier rounds in history.</p><div className="decision-actions"><button className="button primary-button" disabled={!ready || reviewing || !Object.values(answers).some(a => a.trim())} onClick={() => void reviewAnswers()}>{reviewing ? "Reviewing answers…" : "Re-review with Meta"}</button>{!ready && <span className="form-note">Meta API setup is pending. You can save and export answers now.</span>}</div>{questions.length ? questions.map((h,i) => <div className="question-block" key={h.id}><span className="question-index">{String(i+1).padStart(2,"0")}</span><div><h3>{h.expert_question}</h3><p>About: {h.claim}</p><label className="visually-hidden" htmlFor={`answer-${i}`}>Answer to {h.expert_question}</label><textarea id={`answer-${i}`} placeholder="Share the evidence or context behind this decision…" disabled={reviewing} maxLength={8000} value={answers[h.expert_question] || ""} onChange={e => setAnswers({...answers, [h.expert_question]: e.target.value})}/></div></div>) : <div className="panel-empty"><MessageSquare size={28}/><h3>No expert questions</h3><p>This analysis did not return any questions.</p></div>}</section>}
        {view === "new" && <section className="new-analysis"><button className="back-link" onClick={() => setView("review")}><ArrowLeft size={15}/>Back to review</button><h1>Every expert has a way.</h1><p className="new-intro">Watch their work. Uncover the decisions.<br/>Check the reasoning against what you know.</p><form onSubmit={e => {e.preventDefault(); void analyze();}}><fieldset disabled={busy}><label className="field-label" htmlFor="task">What are we observing?</label><textarea id="task" required maxLength={8000} placeholder="Describe the task, equipment, situation, and intended outcome." value={task} onChange={e => setTask(e.target.value)}/><div className="upload-fields"><label className="upload-area"><Film size={25}/><strong>{taskVideo?.name || "Add a work video"}</strong><span>MP4 · up to 100 MB</span><input type="file" accept="video/mp4,.mp4" required onChange={e => setTaskVideo(e.target.files?.[0] || null)}/></label><label className="upload-area"><BookOpen size={25}/><strong>{references.length ? `${references.length} references selected` : "Add reference excerpts"}</strong><span>TXT or Markdown · optional</span><input type="file" accept=".txt,.md" multiple onChange={e => setReferences(Array.from(e.target.files || []))}/></label></div><label className="field-label" htmlFor="transcript">Narration transcript <span>Optional</span></label><input id="transcript" type="file" accept=".txt,.md" onChange={e => setTranscript(e.target.files?.[0] || null)}/><p className="form-note">Timestamped captions help distinguish visible actions from the speaker’s explanation. Use times relative to this clip and label automatic captions.</p><label className="field-label" htmlFor="scope">Reference applicability <span>Optional</span></label><input id="scope" className="text-input" maxLength={8000} placeholder="Document title, issuer, equipment model, and edition" value={scope} onChange={e => setScope(e.target.value)}/><p className="form-note">Video and references are sent to Meta when you start. Use material you have permission to share.</p>{!ready && <div className="api-notice"><CircleHelp size={18}/><p><strong>Meta API setup is needed</strong><br/>Add MODEL_API_KEY to web/.env.local and restart the app. You can open a saved review while API access is pending.</p></div>}<button className="button primary-button start-analysis" disabled={!ready || !taskVideo || !task.trim()}>{busy ? <><LoaderCircle className="spin" size={17}/>Analyzing with Muse Spark…</> : <>Start analysis<ArrowRight size={17}/></>}</button>{busy && <p className="form-note" role="status">Watching the video and reviewing evidence. This can take several minutes. Keep this page open.</p>}</fieldset></form></section>}
        <div hidden={view !== "decisions"}><DecisionTest workflow={data} ready={ready}/></div>
      </main>
    </div>
  </div>;
}
