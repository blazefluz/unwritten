"""Render the local measured pilot without inventing results or model provenance."""
import html
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'clips/usb-cable-tests/pilot-nov2'


def main():
    report=json.loads((OUT/'report.json').read_text())
    e=lambda v:html.escape(str(v),quote=True)
    ranking=report.get('ranking')
    score=ranking['score'] if ranking else None
    measurements={m['id']:m for m in report['observation']['measurements']}
    rows=[]
    for row in report['perception_checks']:
        ok=row['magnitude_matches'] and row['time_window_matches']
        observed=row['observed_signed_v']
        rows.append(f'<tr><td><button data-time="{e(row["measurement_time"])}">{e(row["id"])} · {e(row["measurement_time"])}s</button></td>'
                    f'<td>{e(observed)}</td><td>{e(row["reference_label_magnitude_v"])}</td>'
                    f'<td>{e(round(row["absolute_error_v"],4)) if row["absolute_error_v"] is not None else "Unknown"}</td>'
                    f'<td>{"Match" if ok else "Mismatch / unresolved"}</td></tr>')
    predictions=''.join(f'<tr><td>{e(r["left"])} vs {e(r["right"])}</td>'
        f'<td>{e(r["predicted"] or "Abstained")}</td><td>{e(r["expected"])}</td>'
        f'<td>{"Correct" if r["correct"] else "Miss"}</td>'
        f'<td>{e(r["baseline"] or "Abstained")}</td></tr>' for r in ranking['comparisons']) if ranking else ''
    rank_summary=(f'<div class="metric"><strong>{score["correct"]}/{score["total"]}</strong><span>held-out pair comparisons</span></div>'
        f'<div class="metric"><strong>{score["baseline_correct"]}/{score["total"]}</strong><span>simple magnitude baseline</span></div>') if score else '<p>Ranking not scored: cable alignment needs review.</p>'
    rule=(f'<h2>Frozen rule</h2><p><b>{e(ranking["frozen_rule"]["transform"])} · {e(ranking["frozen_rule"]["direction"])}</b></p>'
        f'<p class="note">Model rationale below is not independently verified; claims about whether prior knowledge was used cannot be established from its self-report.</p><p>{e(ranking["frozen_rule"]["reason"])}</p><p>{e(ranking["frozen_rule"]["limitations"])}</p>') if ranking else ''
    limitations=ranking['limitations'] if ranking else 'Measurement alignment is unresolved; no ranking score is reported.'
    css='''*{box-sizing:border-box}body{margin:0;background:#f7f7f8;color:#202124;font:15px/1.6 "Helvetica Neue",Helvetica,Arial,sans-serif}main{max-width:1120px;margin:auto;padding:40px 24px}h1{font-size:34px;line-height:1.2;letter-spacing:-1px}h2{font-size:21px;margin-top:32px}p{max-width:85ch}.label{color:#a73200;font-size:13px}.panel{background:white;border:1px solid #e5e5e8;padding:24px;margin-top:24px}video{width:100%;max-height:430px;background:#202124}.metrics{display:flex;flex-wrap:wrap;gap:32px;margin:24px 0}.metric strong{font-size:38px;line-height:1.2;display:block}.metric span{display:block;color:#686a70;font-size:13px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:12px 10px;border-bottom:1px solid #e5e5e8;vertical-align:top}th{background:#f7f7f8}button{font:inherit;color:#a73200;border:0;background:transparent;cursor:pointer;text-decoration:underline}a{color:#a73200}code{overflow-wrap:anywhere}.table-wrap{overflow:auto}.note{color:#686a70;font-size:13px}summary{cursor:pointer}@media(max-width:600px){main{padding:24px 14px}.panel{padding:16px}h1{font-size:28px}.metric strong{font-size:30px}.metrics{gap:22px}}'''
    text=f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unwritten · USB cable pilot</title><style>{css}</style><main>
    <p class="label">Unwritten · Real Meta pilot</p><h1>Can the model read the tests and recover the ranking rule?</h1>
    <p>One video. Seven cables. Four training cables, three held-out cables. Final ranking and all audio were excluded from the observation input.</p>
    <div class="metrics"><div class="metric"><strong>{report['perception_correct']}/{report['perception_total']}</strong><span>readings and time windows match reference</span></div>{rank_summary}</div>
    <p class="note">Reading tolerance was set before the run: ±{e(report['reading_tolerance_v'])} V against the creator’s rounded labels, comparing magnitudes. Twelve pairs share only three held-out cables; they are not twelve independent cases.</p>
    <section class="panel"><h2>Source footage</h2><video id="source" src="../5HsQNCVYYvM.mp4" controls preload="metadata"></video><p class="note">Playback includes the answer section for review. Meta received only a silent 127-second measurement section, ending before the answer section.</p>
    <p><a href="{e(report['source'])}">“testing USB charging cables” by pileofstuff</a> · Creative Commons Attribution license (reuse allowed). Clip: original 5:25–8:40.</p></section>
    <section class="panel"><h2>Observation checks</h2><p>Signed meter readings are retained. The reference column contains the creator’s positive written labels. Click a cable to revisit its selected measurement.</p><div class="table-wrap"><table><tr><th>Cable / clip time</th><th>Meta signed volts</th><th>Written magnitude</th><th>Magnitude error</th><th>Check</th></tr>{''.join(rows)}</table></div>
    <p class="note">{e(report['reference_type'])}. A match here is agreement with those transcribed values, not a calibrated measurement accuracy claim.</p></section>
    <section class="panel">{rule}<h2>Held-out preferences</h2><p>Only c1–c4 values and six within-training preferences reached rule inference. Code applied the frozen comparator to c5–c7, with no feedback of target answers.</p><div class="table-wrap"><table><tr><th>Comparison</th><th>Predicted winner</th><th>Reference winner</th><th>Check</th><th>Magnitude baseline</th></tr>{predictions}</table></div></section>
    <section class="panel"><h2>What this establishes</h2><p>{e(limitations)}</p><p>No pass/fail threshold was invented. No manufacturer compliance, constant-current condition, repair outcome, or broad expert skill transfer is established.</p><p><a href="report.json">Raw result JSON</a> · <a href="protocol.json">Protocol and input fingerprint</a> · <a href="ranking_comparator.input.json">Actual rule-inference request</a></p></section>
    </main><script>document.querySelectorAll('button[data-time]').forEach(b=>b.addEventListener('click',()=>{{const v=document.getElementById('source');v.currentTime=Number(b.dataset.time);v.scrollIntoView({{block:'center',behavior:'smooth'}})}}))</script></html>'''
    (OUT/'report.html').write_text(text,encoding='utf-8')
    print(OUT/'report.html')

if __name__=='__main__':main()
