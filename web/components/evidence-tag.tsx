const labels = {observed:"Observed in video",testimony:"Speaker testimony",inferred:"Model inference"};
export default function EvidenceTag({kind}:{kind:keyof typeof labels}) {
  return <span className={`evidence-tag evidence-${kind}`}><span aria-hidden="true"/>{labels[kind]}</span>;
}
