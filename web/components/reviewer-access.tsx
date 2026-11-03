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
    <div className="reviewer-access-head"><KeyRound size={18}/><div><strong>{status?.authorized?(status.remaining===0?"No runs left":"Reviewer access"):"Reviewer access"}</strong><p>{status?.authorized?`${status.remaining} of 6 shared runs left.`:"Enter your code to analyze a video."}</p></div>{status?.authorized?<button className="button" disabled={busy} onClick={()=>void lock()}><LogOut size={14}/>Lock access</button>:<button className="button" aria-expanded={open} onClick={()=>setOpen(!open)}><Lock size={14}/>{open?"Close":"Enter code"}</button>}</div>
    {open&&!status?.authorized&&<form onSubmit={e=>void unlock(e)} className="reviewer-code-form"><label htmlFor="reviewer-code">Reviewer access code<input id="reviewer-code" type="password" autoComplete="off" spellCheck={false} maxLength={200} required value={code} onChange={e=>setCode(e.target.value)}/></label><button className="button primary-button" disabled={busy||!code.trim()}>{busy?"Verifying…":"Verify access"}<ArrowRight size={14}/></button></form>}
    <details className="access-limits"><summary>Usage limits</summary><p>Six accepted video analyses, shared by everyone using the code. Accepted runs count even if they fail. Signing out does not restore uses. Code entry is free. Videos: 2 minutes, 25 MB. Other paid tools run locally.</p></details>
    {error&&<p role="alert" className="reviewer-access-error">{error}</p>}
  </section>;
}
