"""The predict-before-it-happens player: the demo's central moment.

Plays the clip with the rules' prediction shown before each held-out decision, then
reveals what the person actually did and keeps score. Every prediction was computed
in advance by code from the rules; nothing here calls a model.
"""
from __future__ import annotations

import json
from typing import Any

from .learner import LabResult
from .report import CSS, SYNTHETIC_BANNER

LIVE_CSS = """
main{max-width:1180px}
.layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;margin-top:16px}
@media (max-width:860px){.layout{grid-template-columns:minmax(0,1fr)}}
.stage{position:relative;background:#111;border-radius:10px;overflow:hidden;aspect-ratio:16/9;
display:flex;align-items:center;justify-content:center}
.stage video{width:100%;height:100%;object-fit:contain;display:block}
#scene{color:#ecebe6;text-align:center;padding:16px;font-size:22px;font-weight:600}
#scene small{display:block;font-size:13px;font-weight:400;color:#a3a19a;margin-top:6px}
#overlay{position:absolute;left:12px;right:12px;bottom:12px;padding:12px 14px;border-radius:8px;
background:rgba(10,10,10,.86);color:#f4f3ee;border-left:5px solid #8a8a85;font-size:15px}
#overlay[hidden]{display:none}
@media (max-width:560px){#overlay{left:6px;right:6px;bottom:6px;padding:6px 9px}
#overlay .big{font-size:16px}#overlay .sub{font-size:11px;max-height:2.8em;overflow:hidden}}
#overlay .tag{display:block;font-size:11px;font-weight:700;letter-spacing:.08em}
#overlay .big{display:block;font-size:24px;font-weight:700;line-height:1.25;overflow-wrap:anywhere}
#overlay .sub{display:block;font-size:13px;color:#c9c8c1;overflow-wrap:anywhere}
#overlay.predict{border-left-color:#8aa9ff}#overlay.hit{border-left-color:#5fc28e}
#overlay.miss{border-left-color:#f2867e}
.controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:10px 0}
.controls input[type=range]{flex:1 1 180px;min-width:120px}
button{font:inherit;padding:7px 14px;border-radius:7px;border:1px solid var(--line);
background:var(--card);color:var(--ink);cursor:pointer}
button.primary{background:var(--accent);border-color:var(--accent);color:var(--bg);font-weight:600}
button:disabled{opacity:.55;cursor:default}
select{font:inherit;padding:6px;border-radius:7px;border:1px solid var(--line);background:var(--card);color:var(--ink)}
#ticks{position:relative;height:14px;margin:0 0 6px;background:var(--line);border-radius:4px;overflow:hidden}
#ticks i{position:absolute;top:0;bottom:0;width:4px;background:var(--muted)}
#ticks i.pending{background:var(--accent)}#ticks i.hit{background:var(--good)}#ticks i.miss{background:var(--bad)}
.legend{font-size:12px;color:var(--muted)}
.score b{font-size:40px;display:block;line-height:1.1}
.rule.on{background:color-mix(in srgb,var(--accent) 22%,transparent);border-radius:4px}
.rule{padding:2px 4px;overflow-wrap:anywhere}
textarea{width:100%;min-height:64px;font:inherit;padding:8px;border-radius:7px;border:1px solid var(--line);
background:var(--bg);color:var(--ink);margin:6px 0}
#status{white-space:pre-wrap;font-size:13px}.error{color:var(--bad)}
a{color:var(--accent)}
"""

LIVE_JS = r"""
const D = JSON.parse(document.getElementById('lab').textContent);
const $ = id => document.getElementById(id);
const fmt = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
const evs = D.events;
const reveal = e => Math.max(e.time_end, e.time_start + 0.5);
const lastEnd = evs.length ? Math.max(...evs.map(reveal)) : 0;
const HOLD_MS = 2200, SHOW_AFTER = 2.5;

function simClock(duration) {
  let t = 0, running = false, last = 0, rate = 1;
  const sync = () => { if (running) { const n = performance.now();
    t = Math.min(duration, t + (n - last) / 1000 * rate); last = n; if (t >= duration) running = false; } };
  return { get currentTime() { sync(); return t; }, set currentTime(v) { t = v; last = performance.now(); },
    get paused() { sync(); return !running; }, get duration() { return duration; },
    set playbackRate(r) { sync(); rate = r; }, play() { if (t >= duration) t = 0; running = true; last = performance.now(); },
    pause() { sync(); running = false; } };
}

let clock;
function useSim(note) {
  const v = document.querySelector('.stage video'); if (v) v.remove();
  clock = simClock(lastEnd + 2);
  $('scene').hidden = false;
  $('scene-note').textContent = note;
  clock.playbackRate = +$('speed').value;
}
if (D.video) {
  const v = document.createElement('video');
  v.src = D.video; v.playsInline = true; v.preload = 'auto';
  v.addEventListener('error', () => useSim('The video file could not be loaded, so this is a timeline only.'));
  v.addEventListener('click', () => toggle());
  document.querySelector('.stage').prepend(v);
  $('scene').hidden = true;
  clock = v;
} else {
  useSim(D.synthetic ? 'No video: synthetic sample, timeline only.' : 'No video file found: timeline only.');
}

const duration = () => (isFinite(clock.duration) && clock.duration > 0) ? clock.duration : lastEnd + 2;
const ticks = evs.map(e => { const i = document.createElement('i');
  i.title = fmt(e.time_start) + ' ' + e.item; if (e.phase === 'test') i.className = 'pending';
  $('ticks').append(i); return i; });
function placeTicks() { evs.forEach((e, n) => ticks[n].style.left = (e.time_start / duration() * 100) + '%'); }
placeTicks();
if (D.video) document.querySelector('.stage video')?.addEventListener('loadedmetadata', placeTicks);

const announced = new Set();
let holdTimer = null, lastT = 0, scrubbing = false;
function release() { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } }
function toggle() {
  if (holdTimer) { release(); return sync(); }  // the hold already paused it; stay paused
  if (clock.paused) clock.play(); else clock.pause();
  sync();
}
$('play').addEventListener('click', toggle);
$('speed').addEventListener('change', () => { clock.playbackRate = +$('speed').value; });
const seek = $('seek');
seek.addEventListener('input', () => { scrubbing = true; release(); clock.currentTime = +seek.value / 1000 * duration(); });
seek.addEventListener('change', () => { scrubbing = false; });
$('restart').addEventListener('click', () => { release(); announced.clear(); clock.currentTime = 0; lastT = 0; clock.play(); sync(); });

function setOverlay(cls, tag, big, sub) {
  const o = $('overlay'); o.hidden = false; o.className = cls;
  o.querySelector('.tag').textContent = tag;
  o.querySelector('.big').textContent = big;
  o.querySelector('.sub').textContent = sub;
}
function ruleText(e) {
  return e.fired_rule === null ? 'No rule fired, so the default applies.' : 'Because: ' + D.rules[e.fired_rule].text;
}

function sync() {
  const t = clock.currentTime;
  if (Math.abs(t - lastT) > 1.0) {  // a seek: never hold on decisions the viewer jumped past
    announced.clear();
    evs.forEach((e, n) => { if (e.phase === 'test' && e.time_start <= t) announced.add(n); });
  }
  lastT = t;
  if (!scrubbing) seek.value = Math.round(t / duration() * 1000);
  $('clock').textContent = fmt(t) + ' / ' + fmt(duration());
  $('play').textContent = (clock.paused && !holdTimer) ? 'Play' : 'Pause';

  let hits = 0, done = 0, current = null, activeRule = null;
  evs.forEach((e, n) => {
    const started = t >= e.time_start, ended = t >= reveal(e);
    if (e.phase === 'test') {
      if (ended) { done++; if (e.correct) hits++; }
      ticks[n].className = ended ? (e.correct ? 'hit' : 'miss') : 'pending';
      if (started && !announced.has(n) && !ended) {
        announced.add(n);
        if ($('hold').checked && !clock.paused) {
          clock.pause();
          holdTimer = setTimeout(() => { holdTimer = null; clock.play(); }, HOLD_MS);
        }
      }
    }
    if (started && t < reveal(e) + SHOW_AFTER) current = e;
  });

  if (!current) {
    const trained = t < D.cut;
    setOverlay('', trained ? 'WATCHING' : 'PREDICTING NEXT',
      trained ? 'Learning from the first ' + D.trainCount + ' decisions' : 'Waiting for the next decision',
      trained ? 'Predictions start at ' + fmt(D.cut) + '.' : '');
  } else if (current.phase === 'train') {
    setOverlay('', 'LEARNING FROM ' + fmt(current.time_start), current.item + ' → ' + current.actual, current.attrs);
  } else if (t < reveal(current)) {
    activeRule = current.fired_rule;
    setOverlay('predict', 'PREDICTED BEFORE IT HAPPENS', current.item + ' → ' + current.predicted + (current.certain ? '' : ' (uncertain)'), ruleText(current));
  } else if (current.correct) {
    activeRule = current.fired_rule;
    setOverlay('hit', 'CORRECT', '✓ ' + current.actual, 'Predicted ' + current.predicted + ' for ' + current.item + '.');
  } else {
    setOverlay('miss', 'WRONG', '✗ went to ' + current.actual, 'Predicted ' + current.predicted + ' for ' + current.item + '. ' + ruleText(current));
  }
  if (document.getElementById('scene') && !$('scene').hidden) {
    $('scene-main').textContent = current ? current.item : '…';
  }
  $('score').textContent = hits + '/' + done;
  $('score-note').textContent = done < D.testCount
    ? 'held-out decisions so far, of ' + D.testCount
    : Math.round(hits / D.testCount * 100) + '% correct on ' + D.testCount + ' held-out decisions';
  document.querySelectorAll('[data-rule]').forEach(r => r.classList.toggle('on', +r.dataset.rule === activeRule));
}
setInterval(sync, 100);
sync();

const qBox = $('questions');
D.questions.forEach((q, n) => {
  const card = document.createElement('div'); card.className = 'card';
  const b = document.createElement('b'); b.textContent = q.question; card.append(b);
  const p = document.createElement('p'); p.textContent = 'Show next: ' + q.probe; card.append(p);
  const w = document.createElement('p'); w.className = 'muted'; w.textContent = q.why_it_matters; card.append(w);
  if (D.stem) { const a = document.createElement('textarea'); a.dataset.q = n;
    a.setAttribute('aria-label', 'Your answer: ' + q.question); a.placeholder = 'Your answer'; card.append(a); }
  qBox.append(card);
});
if (!D.questions.length) qBox.innerHTML = '<p class="muted">No open questions.</p>';
if (D.stem && D.questions.length) {
  $('submit').hidden = false;
  $('submit').addEventListener('click', async () => {
    const answers = [...document.querySelectorAll('textarea[data-q]')]
      .filter(a => a.value.trim()).map(a => ({ index: +a.dataset.q, answer: a.value.trim() }));
    if (!answers.length) { $('status').textContent = 'Write at least one answer first.'; return; }
    $('submit').disabled = true;
    const r = await fetch('/api/answers/' + D.stem, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }) });
    const body = await r.json();
    if (!r.ok) { $('status').textContent = body.error; $('status').className = 'error'; $('submit').disabled = false; return; }
    const poll = async () => {
      const j = await (await fetch('/api/jobs/' + D.stem)).json();
      $('status').textContent = j.log.join('\n');
      if (j.state === 'running') return setTimeout(poll, 800);
      if (j.state === 'done') return location.reload();
      $('status').textContent += '\n' + j.error; $('status').className = 'error'; $('submit').disabled = false;
    };
    poll();
  });
} else if (D.questions.length) {
  const note = document.createElement('p'); note.className = 'muted';
  note.textContent = 'To answer these and update the rules, open this clip in the app: python -m unwritten serve';
  qBox.append(note);
}
"""


def _live_data(result: LabResult, video_src: str | None, stem: str | None) -> dict[str, Any]:
    assert result.final is not None
    predictions = {p["index"]: p for p in result.predictions}
    events: list[dict[str, Any]] = []
    for ev in sorted(result.train + result.test, key=lambda e: e.time_start):
        attrs = ", ".join(f"{k}={v}" for k, v in ev.attributes.items())
        row: dict[str, Any] = {"item": ev.item, "time_start": ev.time_start, "time_end": ev.time_end,
                               "actual": ev.outcome, "attrs": attrs,
                               "phase": "test" if ev.index in predictions else "train"}
        if ev.index in predictions:
            p = predictions[ev.index]
            row.update(predicted=p["predicted"], correct=p["correct"],
                       fired_rule=p["fired_rule"], certain=p["certain"])
        events.append(row)
    return {
        "stem": stem, "video": video_src, "synthetic": result.synthetic, "events": events,
        "cut": min((e.time_start for e in result.test), default=0),
        "trainCount": len(result.train), "testCount": len(result.test),
        "rules": [{"text": str(r), "why": r.why} for r in result.final.rules],
        "questions": result.questions,
    }


def render_live(result: LabResult, video_src: str | None = None, stem: str | None = None,
                notebook_href: str = "") -> str:
    """Pass `stem` when served by the app; it turns on answering the questions."""
    from .report import _e, _rules_html, _revisions_html

    data = json.dumps(_live_data(result, video_src, stem), ensure_ascii=False).replace("<", "\\u003c")
    final = result.final
    assert final is not None
    links = f'<a href="{_e(notebook_href)}">Full lab notebook</a>' if notebook_href else ""
    home = '<a href="/">All clips</a> · ' if stem else ""
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unwritten live prediction</title><style>{CSS}{LIVE_CSS}</style></head><body><main>
{SYNTHETIC_BANNER if result.synthetic else ''}
<h1>Unwritten — predicting the next decision</h1>
<div class="muted">{home}{links}</div>
<div class="layout"><div>
<div class="stage"><div id="scene"><span id="scene-main">…</span><small id="scene-note"></small></div>
<div id="overlay" aria-live="polite"><span class="tag"></span><span class="big"></span><span class="sub"></span></div></div>
<div class="controls" style="margin-bottom:6px"><button id="play" class="primary">Play</button>
<button id="restart">Restart</button><input id="seek" type="range" min="0" max="1000" value="0" aria-label="Seek">
<span id="clock" class="muted"></span></div>
<div id="ticks" aria-hidden="true"></div>
<div class="controls"><label class="legend"><input id="hold" type="checkbox" checked> Pause on each prediction</label>
<label class="legend">Speed <select id="speed"><option value="1">1×</option><option value="1.5">1.5×</option>
<option value="2">2×</option></select></label>
<span class="legend">Marks: grey learned from, blue to predict, green right, red wrong</span></div>
</div><div>
<div class="card score"><span class="muted">Predicted correctly</span><b id="score">0/0</b><span id="score-note" class="muted"></span></div>
<div class="card"><span class="muted">No-AI baseline</span><b style="display:block;font-size:22px">{result.baseline_test_accuracy:.0%}</b>
<span class="muted" style="font-size:13px;overflow-wrap:anywhere">{_e(result.baseline_description)}</span></div>
<div class="card"><b>The unwritten rules</b>
<p class="muted" style="margin:4px 0 8px;font-size:13px">{_e(final.summary)}</p>{_rules_html(final, numbered_data=True)}</div>
</div></div>
<h2>Questions for the expert</h2><div id="questions"></div>
<button id="submit" class="primary" hidden>Update the rules</button><p id="status" class="muted"></p>
{_revisions_html(result)}
<p class="muted">The rules were learned only from decisions before the first prediction, and code scored
them. The attributes each prediction uses were logged by the model after it watched the whole clip, so
its description of an item may be influenced by where that item went.</p>
<script id="lab" type="application/json">{data}</script><script>{LIVE_JS}</script>
</main></body></html>"""
