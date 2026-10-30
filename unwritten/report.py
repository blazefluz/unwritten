"""Render a LabResult as a self-contained HTML lab notebook."""
from __future__ import annotations

import html
from pathlib import Path

from .learner import LabResult
from .rules import RuleSet

CSS = """
:root{--bg:#f7f6f2;--card:#fff;--ink:#1d1d1b;--muted:#6b6a65;--line:#e4e2db;
--good:#1f7a4d;--bad:#b3261e;--warn:#9a6700;--accent:#2b59c3}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--card:#1e1e1c;--ink:#ecebe6;
--muted:#a3a19a;--line:#33322f;--good:#5fc28e;--bad:#f2867e;--warn:#e0b44f;--accent:#8aa9ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);
font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:980px;margin:0 auto;padding:32px 16px 64px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:32px 0 10px}
.muted{color:var(--muted)}.card{background:var(--card);border:1px solid var(--line);
border-radius:10px;padding:16px;margin:10px 0}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.stat b{display:block;font-size:28px}.rule{font-family:ui-monospace,Menlo,monospace;
font-size:14px}.why{color:var(--muted);font-size:13px;margin:2px 0 10px 18px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.ok{color:var(--good);font-weight:600}.no{color:var(--bad);font-weight:600}
.warn{color:var(--warn)}.wrap{overflow-x:auto}code{font-size:12px}
"""


SYNTHETIC_BANNER = ('<div class="card warn" role="note"><b>Synthetic sample.</b> Hand-written data and '
                    'scripted replies, not Muse Spark output and not from a video.</div>')


def _e(s: object) -> str:
    return html.escape(str(s))


def _rules_html(rs: RuleSet, numbered_data: bool = False) -> str:
    out = []
    for i, r in enumerate(rs.rules):
        data = f' data-rule="{i}"' if numbered_data else ""
        out.append(f'<div class="rule"{data}>{i}. {_e(r)}</div>')
        if r.why:
            out.append(f'<div class="why">{_e(r.why)}</div>')
    out.append(f'<div class="rule">otherwise → {_e(rs.default)}</div>')
    return "\n".join(out)


def _attrs(a: dict) -> str:
    return ", ".join(f"{_e(k)}={_e(v)}" for k, v in a.items())


def _ts(t: float) -> str:
    return f"{int(t // 60)}:{int(t % 60):02d}"


def _revisions_html(result: LabResult) -> str:
    if not result.revisions:
        return ""
    cards = []
    for n, rev in enumerate(result.revisions, 1):
        answers = "".join(f"<li>{_e(a['question'])} <b>{_e(a['answer'])}</b></li>" for a in rev["answers"])
        cards.append(f"""<div class="card"><b>Update {n}</b>
<span class="muted"> · training {rev['train_accuracy_before']:.0%} → {rev['train_accuracy_after']:.0%} ·
held-out {rev['test_accuracy_before']:.0%} → {rev['test_accuracy_after']:.0%}</span>
<ul>{answers}</ul><p>{_e(rev['reasoning'])}</p></div>""")
    return "<h2>What the expert changed</h2>" + "".join(cards)


def render(result: LabResult, live_href: str = "") -> str:
    final = result.final
    assert final is not None
    hits = sum(p["correct"] for p in result.predictions)
    n = len(result.predictions)

    attempts = []
    for a in result.attempts:
        rs = RuleSet.from_dict(a.ruleset)
        sus = "".join(f"<li>event #{_e(s['index'])}: {_e(s['reason'])}</li>" for s in a.suspects)
        attempts.append(f"""<div class="card"><b>Round {a.round}</b>
<span class="muted"> · explains {a.train_accuracy:.0%} of training events ·
{len(a.mistakes)} counterexample(s)</span>
<p>{_e(a.reasoning)}</p>{_rules_html(rs)}
{f'<p class="warn">Flagged as suspect observations:</p><ul>{sus}</ul>' if sus else ''}</div>""")

    preds = "".join(
        f"<tr><td>{_ts(p['time_start'])}</td><td>{_e(p['item'])}<br><span class='muted'>"
        f"{_attrs(p['attributes'])}</span></td><td>{_e(p['predicted'])}"
        f"{'' if p['certain'] else ' <span class=warn>(uncertain)</span>'}</td>"
        f"<td>{_e(p['actual'])}</td><td class='{'ok' if p['correct'] else 'no'}'>"
        f"{'✓' if p['correct'] else '✗'}</td></tr>"
        for p in result.predictions)

    obs_rows = "".join(
        f"<tr><td>{e['index']}</td><td>{_ts(e['time_start'])}</td><td>{_e(e['item'])}</td>"
        f"<td>{_attrs({a['name']: a['value'] for a in e['attributes']} if isinstance(e['attributes'], list) else e['attributes'])}</td>"
        f"<td>{_e(e['outcome'])}</td><td>{e.get('confidence', 1):.2f}</td></tr>"
        for e in result.observation["events"])

    qs = "".join(
        f"<div class='card'><b>{_e(q['question'])}</b><p>Show next: {_e(q['probe'])}</p>"
        f"<p class='muted'>{_e(q['why_it_matters'])} (rule {q['rule_affected']})</p></div>"
        for q in result.questions)

    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unwritten lab notebook</title><style>{CSS}</style></head><body><main>
{SYNTHETIC_BANNER if result.synthetic else ''}
<h1>Unwritten — lab notebook</h1>
<div class="muted">Source: {_e(result.source)} · domain: {_e(result.domain)}
{f'· <a href="{_e(live_href)}" style="color:var(--accent)">Watch it predict</a>' if live_href else ''}</div>

<div class="stats" style="margin-top:18px">
<div class="card stat"><span class="muted">Held-out predictions</span><b>{hits}/{n}</b>
{result.test_accuracy:.0%} correct on events it never saw</div>
<div class="card stat"><span class="muted">No-AI baseline</span>
<b>{result.baseline_test_accuracy:.0%}</b>{_e(result.baseline_description)}</div>
<div class="card stat"><span class="muted">Rules learned</span><b>{len(final.rules)}</b>
after {len(result.attempts)} round(s) of checking</div></div>

<h2>The unwritten rules</h2><div class="card"><p>{_e(final.summary)}</p>{_rules_html(final)}</div>

<h2>Prediction test: learned from the first {len(result.train)} events, predicted the rest</h2>
<div class="card wrap"><table><tr><th>Time</th><th>Item</th><th>Predicted</th><th>Actual</th>
<th></th></tr>{preds}</table></div>

<h2>Questions for the expert</h2>{qs or '<p class="muted">None.</p>'}

{_revisions_html(result)}

<h2>How the rules were found</h2>{''.join(attempts)}

<h2>Observation log (from video)</h2>
<div class="card wrap"><table><tr><th>#</th><th>Time</th><th>Item</th><th>Attributes</th>
<th>Outcome</th><th>Conf.</th></tr>{obs_rows}</table></div>
<p class="muted">{'Scripted replies stand in for the model in this sample.' if result.synthetic else 'Observations and rule hypotheses: Muse Spark via Meta Model API.'}
Accuracy figures: computed by deterministic code, not reported by the model. The model logged each
item's attributes after watching the whole clip, so they may be influenced by where the item went.</p>
</main></body></html>"""


def write(result: LabResult, path: str | Path, live_href: str = "") -> Path:
    path = Path(path)
    path.write_text(render(result, live_href), encoding="utf-8")
    return path
