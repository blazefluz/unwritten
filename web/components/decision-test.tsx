"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload, ArrowDownToLine, LoaderCircle } from "lucide-react";
import { Workflow, time } from "@/lib/workflow";
import { Observation, observationSchema, draftObservationSchema, decisionSchema, DecisionResult } from "@/lib/decisions";

type Draft = {version: 1; source: string; task: string; observation: Observation; labels: Record<string,string>};
const storageKey = "unwritten-decision-draft-v1";
function saveFile(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type: "application/json"}));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function DecisionTest({workflow, ready}: {workflow: Workflow; ready: boolean}) {
  const [draft, setDraft] = useState<Draft>({version: 1, source: workflow.source, task: workflow.task,
    observation: {events: workflow.events.map(e => ({...e}))}, labels: {}});
  const [undoDraft, setUndoDraft] = useState<Draft | null>(null);
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [fraction, setFraction] = useState(0.6);
  const [videoUrl, setVideoUrl] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => {if (videoUrl) URL.revokeObjectURL(videoUrl);}, [videoUrl]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [restored, setRestored] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const resultInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = parseDraft(JSON.parse(raw));
        setDraft(parsed); setNotice("Restored your local annotation draft.");
      }
    } catch {setError("The saved draft could not be restored. Import a backup or start from the open review.");}
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {localStorage.setItem(storageKey, JSON.stringify(draft));}
    catch {setError("Browser storage is full or unavailable. Export your annotation draft to save it.");}
  }, [draft, restored]);
  function parseDraft(raw: unknown): Draft {
    const value = raw as Partial<Draft>;
    const observation = draftObservationSchema.parse(value.observation || raw);
    const labels = value.labels || {};
    if (!labels || typeof labels !== "object" || Array.isArray(labels) ||
        Object.values(labels).some(v => typeof v !== "string" || v.length > 100)) throw new Error("labels");
    return {version: 1, source: typeof value.source === "string" ? value.source : "Imported observations",
      task: typeof value.task === "string" ? value.task : "", observation, labels};
  }
  function update(next: Draft) {setUndoDraft(draft); setDraft(next); setResult(null); setError(""); setNotice("");}
  function edit(index: number, patch: Partial<Observation["events"][number]>) {
    update({...draft, observation: {events: draft.observation.events.map((e,i) => i === index ? {...e,...patch} : e)}});
  }
  const events = draft.observation.events;
  const sorted = [...events].sort((a,b) => a.time_start - b.time_start || a.time_end - b.time_end);
  const split = Math.max(1, Math.min(events.length - 1, Math.floor(events.length * fraction)));
  const overlap = sorted.some((e,i) => i > 0 && sorted[i-1].time_end > e.time_start);
  const malformed = !observationSchema.safeParse(draft.observation).success || events.some(e => !e.action.trim());
  const missing = events.filter(e => !draft.labels[e.id]?.trim()).length;
  const eligible = events.length >= 3 && events.length <= 50 && !missing && !overlap && !malformed;
  async function run() {
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/decisions", {method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({observation: {...draft.observation,source:draft.source,task:draft.task}, labels: Object.fromEntries(events.map(e => [e.id,draft.labels[e.id].trim()])), train_fraction: fraction})});
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setResult(decisionSchema.parse(payload));
    } catch (err) {setError(err instanceof Error ? err.message : "Test failed. Your draft is saved locally.");}
    finally {setBusy(false);}
  }
  return <section className="document-view decision-view">
    <div className="section-bar"><div><span className="eyebrow">Teach and test</span><h1>Test the next decision</h1></div><span className="badge">Human labels required</span></div>
    <p className="view-description">Correct the observations, name each action, then test whether rules learned from the beginning predict what happens later. Annotation works offline.</p>
    <p className="view-description">{draft.task}</p>
    <p className="form-note">Draft source: {draft.source || "Not specified"}. Edits here do not change the open review or its reference assessments.</p>
    <div className="decision-actions">
      <button className="button" disabled={busy} onClick={() => update({version:1,source:"",task:"",labels:{},observation:{events:[{id:`event-${crypto.randomUUID()}`,time_start:0,time_end:1,action:"",visible_evidence:"",observed_result:"Unknown",uncertainties:[]}]}})}>New annotation</button>
      <button className="button" disabled={busy} onClick={() => input.current?.click()}><Upload size={15}/>Import observations or draft</button>
      <button className="button" disabled={!undoDraft || busy} onClick={() => {if(undoDraft){setDraft(undoDraft);setUndoDraft(null);setResult(null);setNotice("Undid the last draft change.");}}}>Undo last change</button>
      <button className="button" onClick={() => saveFile(draft, "unwritten.annotations.json")}><ArrowDownToLine size={15}/>Save draft</button>
      <button className="button" disabled={busy} onClick={() => {update({version: 1, source: workflow.source, task: workflow.task, observation: {events: workflow.events.map(e => ({...e}))}, labels: {}}); setNotice("Copied the open review. The previous draft was replaced.");}}>Use open review</button>
    </div>
    <input className="visually-hidden" ref={input} type="file" accept=".json" aria-label="Import annotation draft" onChange={async e => {
      const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
      try {if (file.size > 2_000_000) throw new Error("size"); update(parseDraft(JSON.parse(await file.text()))); setNotice("Imported observations. Check every action against the source video.");}
      catch {setError("Choose valid workflow observations or an annotation draft under 2 MB.");}
    }}/>
    {notice && <p role="status" className="api-notice">{notice}</p>}
    {error && <p role="alert" className="error-message">{error}</p>}
    <label className="field-label" htmlFor="annotation-task">Task being observed</label>
    <input id="annotation-task" className="text-input" maxLength={8000} value={draft.task} disabled={busy} onChange={e => update({...draft,task:e.target.value})}/>
    <label className="field-label" htmlFor="annotation-source">Source video or recording</label>
    <input id="annotation-source" className="text-input" value={draft.source} disabled={busy} onChange={e => update({...draft,source:e.target.value})}/>
    <div className="annotation-video">
      <button className="button" onClick={() => videoInput.current?.click()}>{videoUrl ? "Replace local video" : "Attach video for annotation"}</button>
      <input className="visually-hidden" ref={videoInput} type="file" accept=".mp4,video/mp4" aria-label="Attach annotation video" onChange={e => {const file=e.target.files?.[0];e.target.value="";if(!file)return;if(!/\.mp4$/i.test(file.name)){setError("Choose an MP4 video.");return;}setVideoUrl(URL.createObjectURL(file));}}/>
      {videoUrl && <><video ref={video} src={videoUrl} controls onError={() => setError("The local video could not be played. Choose another MP4.")}/><p className="form-note">Local preview only. Match this recording to the draft source. Reattach after refreshing.</p></>}
    </div>
    <fieldset disabled={busy} className="annotation-fieldset">
      <p className="view-description">Use consistent action categories such as “inspect”, “adjust”, and “test”. These are examples. Label what happened, not what should have happened.</p>
      {events.map((event,index) => <details key={event.id} className="annotation-event" open={index === 0 ? true : undefined}><summary>Event {index+1} · {time(event.time_start)} — {draft.labels[event.id] || "Unlabelled"}</summary><div className="annotation-event-body">
        <div className="section-bar"><h3>Event {index+1} <span className="subtle">{event.id}</span></h3><button className="button" aria-label={`Remove event ${index+1}`} disabled={events.length === 1} onClick={() => update({...draft, observation: {events: events.filter((_,i) => i !== index)}, labels: Object.fromEntries(Object.entries(draft.labels).filter(([id]) => id !== event.id))})}><Trash2 size={14}/>Remove</button></div>
        <button className="small-button" disabled={!videoUrl} onClick={() => {if(video.current) video.current.currentTime=event.time_start;}}>Seek video to {time(event.time_start)}</button>
        <div className="annotation-grid"><label>Start (seconds)<input type="number" min="0" step="0.1" value={event.time_start} onChange={e => edit(index,{time_start: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0})}/></label><label>End (seconds)<input type="number" min="0" step="0.1" value={event.time_end} onChange={e => edit(index,{time_end: Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0})}/></label><label>Action category<input maxLength={100} value={draft.labels[event.id] || ""} onChange={e => update({...draft,labels:{...draft.labels,[event.id]:e.target.value}})}/></label></div>
        <label className="annotation-label">Observed action<textarea value={event.action} maxLength={8000} onChange={e => edit(index,{action:e.target.value})}/></label>
        <label className="annotation-label">Visible or audible evidence<textarea value={event.visible_evidence} maxLength={8000} onChange={e => edit(index,{visible_evidence:e.target.value})}/></label>
        <label className="annotation-label">Speaker’s explanation (testimony)<textarea value={event.speaker_explanation || ""} maxLength={8000} onChange={e => edit(index,{speaker_explanation:e.target.value})}/></label>
        <label className="annotation-label">Observed result<input value={event.observed_result} maxLength={8000} onChange={e => edit(index,{observed_result:e.target.value})}/></label>
        <label className="annotation-label">Uncertainties (one per line)<textarea value={event.uncertainties.join("\n")} maxLength={8000} onChange={e => edit(index,{uncertainties:e.target.value.split("\n")})}/></label>
      </div></details>)}
      <button className="button" disabled={events.length >= 50} onClick={() => {const last = sorted.at(-1); const start = last?.time_end || 0; update({...draft,observation:{events:[...events,{id:`event-${crypto.randomUUID()}`,time_start:start,time_end:start+1,action:"",visible_evidence:"",observed_result:"Unknown",uncertainties:[]}]}});}}><Plus size={15}/>Add event</button>
      <div className="decision-actions"><button className="button" disabled={malformed} onClick={() => saveFile({kind:"workflow_observations",source:draft.source,task:draft.task,events}, "clip.workflow.observations.json")}>Export corrected observations</button><button className="button" disabled={!!missing} onClick={() => saveFile(Object.fromEntries(events.map(e => [e.id,draft.labels[e.id].trim()])), "human-labels.json")}>Export labels</button></div>
      <div className="test-setup"><h3>Chronological test</h3><label htmlFor="train-fraction">Training prefix <select id="train-fraction" value={fraction} onChange={e => {setFraction(Number(e.target.value));setResult(null);}}><option value={0.4}>40%</option><option value={0.6}>60%</option><option value={0.8}>80%</option></select></label><p>{events.length >= 3 ? `${split} training events · ${events.length-split} predictions · ${1+events.length-split} Meta requests` : "Add at least 3 events to test a sequence."}</p>
      {!!missing && <p>{missing} events still need an action category.</p>}{overlap && <p className="validation-errors">Events overlap. Separate the intervals to avoid leaking the next action.</p>}{malformed && <p className="validation-errors">Each event needs an action and valid start/end times.</p>}
      {!ready && <p className="api-notice">Meta API setup is pending. Save your draft now; run the test when the key is configured.</p>}
      <p className="form-note">Running sends your corrected observations and labels to Meta. Rules stay frozen; each prediction sees only earlier events. This measures action prediction, not repair correctness.</p>
      <button className="button primary-button" disabled={!ready || !eligible || busy} onClick={() => void run()}>{busy ? <><LoaderCircle className="spin" size={15}/>Testing decisions…</> : "Run with Meta"}</button></div>
    </fieldset>
    <div className="decision-actions"><button className="button" onClick={() => resultInput.current?.click()}>Open evaluation JSON</button>{result && <button className="button" onClick={() => saveFile(result,"unwritten.decisions.json")}>Export evaluation</button>}</div>
    <input className="visually-hidden" ref={resultInput} aria-label="Open decision evaluation" type="file" accept=".json" onChange={async e => {const file=e.target.files?.[0];e.target.value="";if(!file)return;try{if(file.size>2_000_000)throw new Error("size");setResult(decisionSchema.parse(JSON.parse(await file.text())));setError("");}catch{setError("Choose a valid decision evaluation with consistent scores, under 2 MB.");}}}/>
    {result && <div className="decision-results"><h3>Evaluation result</h3><p className="form-note">Report source: {result.source || "Not recorded"}</p><p className="decision-score">{result.score.correct}<span> / {result.score.total} correct</span></p><p>Majority baseline: {result.score.baseline_correct} / {result.score.total} · Abstained: {result.score.abstained}</p><details><summary>Frozen rules</summary><ul>{result.frozen_rules.map((rule,i)=><li key={i}>{rule}</li>)}</ul></details>{result.predictions.map(row=><article className="prediction-row" key={row.event_id}><div className="section-bar"><strong>{time(row.time_start)} · {row.event_id}</strong><span className={`badge ${row.correct ? "supported" : "conflicts"}`}>{row.correct ? "Correct" : row.prediction ? "Miss" : "Abstained"}</span></div><p>Predicted: <strong>{row.prediction || "No prediction"}</strong> · Observed: <strong>{row.actual}</strong></p><p>{row.reason}</p><p className="form-note">Uncertainty: {row.uncertainty}</p></article>)}<p className="form-note">{result.limitations}</p>{result.input_sha256 && <details><summary>Input fingerprint</summary><code>{result.input_sha256}</code></details>}<p className="form-note">An imported evaluation is an external report. Arithmetic is checked here; its model execution and labels are not independently verified.</p></div>}
  </section>;
}
