"""Render the "predict before it happens" player as a self-contained HTML page.

The player replays the clip and, for every held-out event, shows the rules'
prediction the moment the item is picked up, then reveals what the person
actually did when it is placed. Predictions are read from the lab record
(`<clip>.lab.json`), so they were all made by code before playback started;
the page only times when they are shown.

Without a video (e.g. the synthetic fixture) a simulated clock drives the same
timeline, so the view can be checked offline.
"""
from __future__ import annotations

import html
import json
from pathlib import Path
from typing import Any

from .report import CSS as REPORT_CSS
from .rules import RuleSet

CSS = REPORT_CSS + """
.stage{position:relative;background:#000;border-radius:10px;overflow:hidden;aspect-ratio:16/9}
.stage video{width:100%;height:100%;display:block}
.stage .sim{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
color:#a3a19a;font-size:14px;text-align:center;padding:16px}
.overlay{position:absolute;left:12px;right:12px;bottom:12px;display:flex;justify-content:center}
.callout{background:rgba(20,20,19,.88);color:#ecebe6;border-radius:10px;padding:10px 14px;
max-width:520px;width:100%;font-size:15px;border:2px solid transparent}
.callout .lbl{font-size:12px;color:#a3a19a;text-transform:uppercase;letter-spacing:.04em}
.callout .dest{font-size:22px;font-weight:700}
.callout.hit{border-color:#5fc28e}.callout.miss{border-color:#f2867e}
.phase{position:absolute;top:12px;left:12px;background:rgba(20,20,19,.88);color:#ecebe6;
border-radius:999px;padding:4px 12px;font-size:13px}
.controls{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}
button{font:inherit;padding:6px 14px;border-radius:8px;border:1px solid var(--line);
background:var(--card);color:var(--ink);cursor:pointer}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff}
tr.now{background:rgba(127,127,127,.12)}td.pending{color:var(--muted)}
"""

_JS = """
const D = JSON.parse(document.getElementById('lab-data').textContent);
const video = document.getElementById('video');
const callout = document.getElementById('callout');
const phase = document.getElementById('phase');
const clockEl = document.getElementById('clock');
const scoreEl = document.getElementById('score');
const rows = D.predictions.map(p => document.getElementById('p' + p.index));
const fmt = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// Simulated clock when there is no video file.
let simT = 0, simPlaying = false, last = null;
const now = () => video ? video.currentTime : simT;
function tick(ts) {
  if (simPlaying && last !== null) simT = Math.min(D.duration, simT + (ts - last) / 1000);
  if (simT >= D.duration) simPlaying = false;
  last = ts; render(); requestAnimationFrame(tick);
}
function play() { if (video) video.play(); else simPlaying = true; }
function pause() { if (video) video.pause(); else simPlaying = false; }
function seek(t) { if (video) video.currentTime = t; else simT = t; render(); }
document.getElementById('play').onclick = play;
document.getElementById('pause').onclick = pause;
document.getElementById('jump').onclick = () => { seek(Math.max(0, D.cut - 2)); play(); };
document.getElementById('restart').onclick = () => { seek(0); play(); };

function render() {
  const t = now();
  clockEl.textContent = fmt(t);
  phase.textContent = t < D.cut
    ? 'Watching: learning from the first ' + D.train_count + ' events'
    : 'Predicting: rules are fixed, events never seen';
  let hits = 0, done = 0, active = null;
  D.predictions.forEach((p, i) => {
    const row = rows[i], cell = row.querySelector('.actual'), mark = row.querySelector('.mark');
    const shown = t >= p.time_start, revealed = t >= p.time_end;
    row.querySelector('.pred').textContent = shown ? p.predicted : '…';
    cell.textContent = revealed ? p.actual : '…';
    cell.className = 'actual' + (revealed ? '' : ' pending');
    mark.textContent = revealed ? (p.correct ? '✓' : '✗') : '';
    mark.className = 'mark ' + (revealed ? (p.correct ? 'ok' : 'no') : '');
    row.classList.toggle('now', shown && t < p.time_end + 2.5);
    if (revealed) { done++; hits += p.correct; }
    if (shown && t < p.time_end + 2.5) active = p;
  });
  scoreEl.textContent = done ? hits + '/' + done + ' correct so far' : 'No predictions checked yet';
  if (!active) { callout.hidden = true; return; }
  const revealed = t >= active.time_end;
  callout.hidden = false;
  callout.className = 'callout' + (revealed ? (active.correct ? ' hit' : ' miss') : '');
  callout.innerHTML = '<div class="lbl">' + esc(active.item) + ' · rule ' +
    (active.fired_rule === null ? 'default' : '#' + active.fired_rule) +
    (active.certain ? '' : ' · uncertain') + '</div>' +
    '<div>Predicted: <span class="dest">' + esc(active.predicted) + '</span></div>' +
    (revealed ? '<div>Actual: <b>' + esc(active.actual) + '</b> ' +
      (active.correct ? '✓' : '✗') + '</div>' : '<div class="lbl">waiting for placement…</div>');
}
if (video) { video.addEventListener('timeupdate', render); video.addEventListener('seeked', render); }
requestAnimationFrame(tick);
"""


def _e(s: object) -> str:
    return html.escape(str(s))


def _ts(t: float) -> str:
    return f"{int(t // 60)}:{int(t % 60):02d}"


def _json_for_script(data: Any) -> str:
    # Keep model-written strings from closing the <script> element.
    return json.dumps(data, ensure_ascii=False).replace("</", "<\\/")


def render(lab: dict[str, Any], video_src: str | None = None) -> str:
    """Build the player from a lab record (the dict written to `<clip>.lab.json`)."""
    events = lab["observation"]["events"]
    by_index = {e["index"]: e for e in events}
    train_ids = lab["split"]["train"]
    preds = []
    for p in lab["predictions"]:
        ev = by_index.get(p["index"], {})
        preds.append({**p, "time_end": float(ev.get("time_end") or p["time_start"])})
    # Prediction phase starts right after the last training event ends.
    cut = max((float(by_index[i].get("time_end") or 0) for i in train_ids), default=0.0)
    duration = max((float(e.get("time_end") or 0) for e in events), default=0.0) + 3
    data = {"predictions": preds, "cut": cut, "duration": duration,
            "train_count": len(train_ids)}

    final = RuleSet.from_dict(lab["final_rules"])
    rules = "".join(f'<div class="rule">{i}. {_e(r)}</div>' for i, r in enumerate(final.rules))
    rules += f'<div class="rule">otherwise → {_e(final.default)}</div>'

    rows = "".join(
        f"<tr id='p{p['index']}'><td>{_ts(p['time_start'])}</td><td>{_e(p['item'])}</td>"
        f"<td class='pred'>…</td><td class='actual pending'>…</td><td class='mark'></td></tr>"
        for p in preds)

    if video_src:
        media = f'<video id="video" src="{_e(video_src)}" controls playsinline></video>'
    else:
        media = ('<div class="sim">No video attached: a simulated clock replays the logged '
                 'event times.<br>Pass --video clip.mp4 to play the real clip.</div>')

    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unwritten prediction player</title><style>{CSS}</style></head><body><main>
<h1>Unwritten: predicting the next decisions</h1>
<div class="muted">Source: {_e(lab.get('source', ''))} · learned from the first
{len(train_ids)} events, predicting the {len(preds)} after them</div>

<div class="stage" style="margin-top:16px">{media}
<div class="phase" id="phase"></div>
<div class="overlay"><div class="callout" id="callout" hidden></div></div></div>

<div class="controls"><button class="primary" id="jump">Jump to predictions</button>
<button id="play">Play</button><button id="pause">Pause</button>
<button id="restart">From the start</button>
<span class="muted"><span id="clock">0:00</span> · <span id="score"></span></span></div>

<h2>The rules it is using (fixed before the held-out part plays)</h2>
<div class="card">{rules}</div>

<h2>Held-out events</h2>
<div class="card wrap"><table><tr><th>Time</th><th>Item</th><th>Predicted</th>
<th>Actual</th><th></th></tr>{rows}</table></div>
<p class="muted">Each prediction is shown when the item is picked up and checked when it is
placed. The rules were learned only from the earlier events, and every prediction was
computed by deterministic code from those rules before playback started.</p>
</main>
<script type="application/json" id="lab-data">{_json_for_script(data)}</script>
<script>{_JS}</script></body></html>"""


def write(lab: dict[str, Any], path: str | Path, video: str | Path | None = None) -> Path:
    """Write the player; the video is referenced relative to the HTML file."""
    path = Path(path)
    src = None
    if video:
        video = Path(video)
        try:
            src = video.resolve().relative_to(path.resolve().parent).as_posix()
        except ValueError:
            src = video.resolve().as_uri()
    path.write_text(render(lab, src), encoding="utf-8")
    return path
