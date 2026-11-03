"use client";
import { useEffect, useState } from "react";
import { ArrowRight, KeyRound, Lock, LogOut } from "lucide-react";
type Status={configured:boolean;authorized:boolean;remaining:number|null;limit:number;ready:boolean};
export default function ReviewerAccess({onReady}:{onReady:(ready:boolean)=>void}) {
  const [status,setStatus]=useState<Status|null>(null),[code,setCode]=useState("");
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function refresh() {
    try {const response=await fetch("/api/access",{cache:"no-store"});if(!response.ok)throw new Error();const result=await response.json();setStatus(result);onReady(result.ready);}
    catch {onReady(false);setError("Reviewer access is unavailable. Live analysis remains locked.");}
  }
  useEffect(()=>{void refresh();const changed=()=>void refresh();window.addEventListener("unwritten:access-changed",changed);return()=>window.removeEventListener("unwritten:access-changed",changed);},[]);
  async function unlock(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError("");
    try {const response=await fetch("/api/access",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});const result=await response.json();if(!response.ok)throw new Error(result.error);setCode("");setOpen(false);await refresh();}
    catch(e){setError(e instanceof Error?e.message:"Access could not be verified.");}
    finally {setBusy(false);}
  }
  async function lock() {setBusy(true);try{await fetch("/api/access",{method:"DELETE"});await refresh();}finally{setBusy(false);}}
  return <section className="reviewer-access" aria-label="Submission reviewer access">
    <div className="reviewer-access-head"><KeyRound size={18}/><div><strong>{status?.authorized?(status.remaining===0?"Reviewer allowance used":"Reviewer access unlocked"):"Have a submission access code?"}</strong><p>{status?.authorized?`${status.remaining} of 6 live video analyses remaining across all reviewers using this code.`:"Saved examples are public. A private reviewer code unlocks a shared allowance of six live video analyses."}</p></div>{status?.authorized?<button className="button" disabled={busy} onClick={()=>void lock()}><LogOut size={14}/>Lock access</button>:<button className="button" aria-expanded={open} onClick={()=>setOpen(!open)}><Lock size={14}/>{open?"Close":"Enter code"}</button>}</div>
    {open&&!status?.authorized&&<form onSubmit={e=>void unlock(e)} className="reviewer-code-form"><label htmlFor="reviewer-code">Reviewer access code<input id="reviewer-code" type="password" autoComplete="off" spellCheck={false} maxLength={200} required value={code} onChange={e=>setCode(e.target.value)}/></label><button className="button primary-button" disabled={busy||!code.trim()}>{busy?"Verifying…":"Verify access"}<ArrowRight size={14}/></button></form>}
    {status?.authorized&&<p className="form-note">Up to 2 minutes and 25 MB per video. Starting an accepted analysis uses one run, including runs that later fail. Signing out does not restore uses. Code entry itself uses no run. Other paid tools remain local-only.</p>}
    {error&&<p role="alert" className="reviewer-access-error">{error}</p>}
  </section>;
}
