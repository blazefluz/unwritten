// Shape, not just colour, separates each kind of evidence: solid, round, dashed, filled-green, striped.
const labels = {observed:"Observed in video",testimony:"Speaker testimony",inferred:"Model inference",attested:"Reviewer self-attestation",demo:"Demonstration only"};
export type EvidenceKind = keyof typeof labels;
export default function EvidenceTag({kind,label}:{kind:EvidenceKind;label?:string}) {
  return <span className={`evidence-tag evidence-${kind}`}><span aria-hidden="true"/>{label||labels[kind]}</span>;
}
