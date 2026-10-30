"""The local app: upload a clip, watch the predictions, answer the expert questions.

Standard library only. It binds to localhost, and it refuses requests from other
sites because each job spends API credits.
"""
from __future__ import annotations

import json
import os
import re
import threading
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, unquote, urlsplit

from .client import MAX_UPLOAD_BYTES, ModelClient, load_dotenv
from .learner import apply_answers
from .live import render_live
from .prompts import DOMAINS
from .report import CSS, _e, render
from .sample import SAMPLE_STEM, ScriptedClient
from .workspace import DEFAULT_DIR, build_sample, learn_clip, load_lab, observe_clip, save_lab, slug

STEM = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
LOCAL_HOSTS = {"localhost", "127.0.0.1", "[::1]"}
CHUNK = 1024 * 1024

HOME_CSS = """
form{display:grid;gap:10px;max-width:520px}label{display:grid;gap:4px;font-size:14px}
input,select,textarea{font:inherit;padding:8px;border-radius:7px;border:1px solid var(--line);
background:var(--bg);color:var(--ink)}
button{font:inherit;padding:8px 14px;border-radius:7px;border:1px solid var(--accent);
background:var(--accent);color:var(--bg);font-weight:600;cursor:pointer;justify-self:start}
button:disabled{opacity:.55;cursor:default}a{color:var(--accent)}
#log{white-space:pre-wrap;font-size:13px}.error{color:var(--bad)}
"""

HOME_JS = r"""
const f = document.getElementById('run'), log = document.getElementById('log');
f && f.addEventListener('submit', async ev => {
  ev.preventDefault();
  const file = f.video.files[0]; if (!file) return;
  f.querySelector('button').disabled = true; log.className = ''; log.textContent = 'Uploading ' + file.name + '…';
  const fail = m => { log.textContent += '\n' + m; log.className = 'error'; f.querySelector('button').disabled = false; };
  try {
    const q = new URLSearchParams({ name: file.name, domain: f.domain.value });
    const r = await fetch('/api/upload?' + q, { method: 'POST', body: file,
      headers: { 'Content-Type': 'video/mp4', 'X-Unwritten-Context': encodeURIComponent(f.context.value) } });
    const body = await r.json(); if (!r.ok) return fail(body.error);
    const poll = async () => {
      const j = await (await fetch('/api/jobs/' + body.stem)).json();
      log.textContent = j.log.join('\n');
      if (j.state === 'running') return setTimeout(poll, 1000);
      if (j.state === 'done') location.href = '/lab/' + body.stem; else fail(j.error);
    };
    poll();
  } catch (e) { fail(String(e)); }
});
"""


class App:
    def __init__(self, workdir: str | Path = DEFAULT_DIR,
                 client_factory: Callable[[], ModelClient] | None = None) -> None:
        self.workdir = Path(workdir)
        self.workdir.mkdir(parents=True, exist_ok=True)
        self._injected = client_factory is not None
        self.client_factory = client_factory or self._meta_client
        self.jobs: dict[str, dict[str, Any]] = {}
        self.lock = threading.Lock()

    @staticmethod
    def _meta_client() -> ModelClient:
        from .client import MetaClient
        return MetaClient()

    def has_key(self) -> bool:
        load_dotenv()
        return self._injected or bool(os.environ.get("MODEL_API_KEY"))

    def path(self, stem: str, suffix: str) -> Path:
        return self.workdir / f"{stem}{suffix}"

    def labs(self) -> list[tuple[str, dict[str, Any]]]:
        rows = []
        for p in sorted(self.workdir.glob("*.lab.json"), key=lambda p: p.stat().st_mtime, reverse=True):
            rows.append((p.name.removesuffix(".lab.json"), json.loads(p.read_text())))
        return rows

    def unique_stem(self, name: str) -> str:
        base = slug(name)
        if base == SAMPLE_STEM:
            base = "clip-sample"
        stem, n = base, 2
        while self.path(stem, ".mp4").exists() or self.path(stem, ".lab.json").exists() or stem in self.jobs:
            stem, n = f"{base}-{n}", n + 1
        return stem

    def video_file(self, stem: str) -> Path | None:
        local = self.path(stem, ".mp4")
        if local.is_file():
            return local
        lab = self.path(stem, ".lab.json")
        if lab.is_file():
            source = Path(json.loads(lab.read_text()).get("source", ""))
            if source.suffix.lower() == ".mp4" and source.is_file():
                return source
        return None

    def start(self, stem: str, work: Callable[[Callable[[str], None]], None]) -> bool:
        with self.lock:
            if self.jobs.get(stem, {}).get("state") == "running":
                return False
            job: dict[str, Any] = {"state": "running", "log": [], "error": ""}
            self.jobs[stem] = job

        def run() -> None:
            try:
                work(job["log"].append)
                job["state"] = "done"
            except Exception as exc:  # shown to the user; the page offers a retry
                traceback.print_exc()
                job["error"], job["state"] = f"{type(exc).__name__}: {exc}", "error"

        threading.Thread(target=run, daemon=True).start()
        return True

    def run_clip(self, stem: str, domain: str, context: str) -> None:
        video = str(self.path(stem, ".mp4"))

        def work(log: Callable[[str], None]) -> None:
            client = self.client_factory()
            obs = observe_clip(client, video, domain, context, out_dir=self.workdir, log=log)
            learn_clip(client, obs, domain, out_dir=self.workdir, log=log)

        self.start(stem, work)

    def answer(self, stem: str, submitted: list[dict[str, Any]]) -> tuple[int, dict[str, Any]]:
        result = load_lab(stem, self.workdir)
        answers = []
        for item in submitted:
            index, text = item.get("index"), str(item.get("answer", "")).strip()
            if not isinstance(index, int) or not 0 <= index < len(result.questions) or not text:
                return 400, {"error": "Each answer needs a valid question and some text."}
            q = result.questions[index]
            answers.append({"question": q["question"], "probe": q["probe"], "answer": text})
        if not answers:
            return 400, {"error": "Write at least one answer first."}
        if not result.synthetic and not self.has_key():
            return 400, {"error": "Set MODEL_API_KEY first."}

        def work(log: Callable[[str], None]) -> None:
            client = ScriptedClient(revising_from_answers=True) if result.synthetic else self.client_factory()
            apply_answers(client, result, answers, log=log)
            save_lab(result, stem, self.workdir)

        if not self.start(stem, work):
            return 409, {"error": "This clip is already being processed."}
        return 202, {"stem": stem}

    def home_page(self) -> str:
        rows = "".join(
            f"<tr><td><a href='/lab/{_e(stem)}'>{_e(stem)}</a>"
            f"{' <span class=warn>(synthetic)</span>' if lab.get('synthetic') else ''}</td>"
            f"<td>{sum(p['correct'] for p in lab['predictions'])}/{len(lab['predictions'])}</td>"
            f"<td>{lab['baseline']['test_accuracy']:.0%}</td></tr>"
            for stem, lab in self.labs())
        table = (f"<div class='card wrap'><table><tr><th>Clip</th><th>Held-out correct</th>"
                 f"<th>No-AI baseline</th></tr>{rows}</table></div>") if rows else ""
        options = "".join(f"<option>{_e(d)}</option>" for d in DOMAINS)
        form = f"""<div class="card"><form id="run">
<label>Video (mp4, 1–2 minutes works best)<input name="video" type="file" accept="video/mp4,.mp4" required></label>
<label>What the clip shows<select name="domain">{options}</select></label>
<label>Context for the observer (optional)<input name="context" placeholder="e.g. warehouse returns desk"></label>
<button>Watch and learn</button></form><p id="log" class="muted"></p></div>"""
        if not self.has_key():
            form = ("<div class='card'><b>Add your Meta Model API key to run a clip.</b><p class='muted'>"
                    "Put <code>MODEL_API_KEY=...</code> in a <code>.env</code> file here, then restart. "
                    "You can try the synthetic sample without one.</p></div>")
        return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Unwritten</title>
<style>{CSS}{HOME_CSS}</style></head><body><main><h1>Unwritten</h1>
<p class="muted">Learn the rules nobody wrote down, by watching someone work.</p>
<h2>Learn from a new clip</h2>{form}
<h2>Your clips</h2>{table or '<p class="muted">Nothing here yet.</p>'}
<p><a href="/lab/{SAMPLE_STEM}">Open the synthetic sample</a>
<span class="muted"> · hand-written data and scripted replies, not model output</span></p>
<script>{HOME_JS}</script></main></body></html>"""


def _handler(app: App) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args: Any) -> None:
            pass

        def _send(self, status: int, body: bytes, ctype: str, extra: dict[str, str] | None = None) -> None:
            self.send_response(status)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(body)

        def _json(self, status: int, data: dict[str, Any]) -> None:
            self._send(status, json.dumps(data).encode(), "application/json")

        def _html(self, page: str) -> None:
            self._send(200, page.encode(), "text/html; charset=utf-8")

        def _trusted(self) -> bool:
            """Block DNS rebinding and other sites posting to this server."""
            host = urlsplit(f"//{self.headers.get('Host', '')}").hostname or ""
            if (f"[{host}]" if ":" in host else host) not in LOCAL_HOSTS:
                return False
            origin = self.headers.get("Origin")
            return origin is None or urlsplit(origin).netloc == self.headers.get("Host")

        def do_GET(self) -> None:
            if not self._trusted():
                return self._json(403, {"error": "Local requests only."})
            path = urlsplit(self.path).path
            if path == "/":
                return self._html(app.home_page())
            parts = [unquote(p) for p in path.strip("/").split("/")]
            if len(parts) >= 2 and STEM.match(parts[1]):
                stem = parts[1]
                if parts[0] == "lab" and len(parts) <= 3:
                    return self._lab(stem, parts[2] if len(parts) == 3 else None)
                if parts[:1] == ["video"] and len(parts) == 2:
                    return self._video(stem)
            if len(parts) == 3 and parts[:2] == ["api", "jobs"] and STEM.match(parts[2]):
                job = app.jobs.get(parts[2])
                return self._json(200, job) if job else self._json(404, {"error": "No such job."})
            self._json(404, {"error": "Not found."})

        def _lab(self, stem: str, page: str | None) -> None:
            if stem == SAMPLE_STEM and not app.path(stem, ".lab.json").exists():
                build_sample(app.workdir)
            if not app.path(stem, ".lab.json").is_file() or page not in (None, "notebook"):
                return self._send(404, b"No such clip.", "text/plain")
            result = load_lab(stem, app.workdir)
            if page == "notebook":
                return self._html(render(result, live_href=f"/lab/{stem}"))
            video = None
            if app.video_file(stem):
                video = f"/video/{stem}"
            elif result.source.startswith("https://"):
                video = result.source
            self._html(render_live(result, video, stem=stem, notebook_href=f"/lab/{stem}/notebook"))

        def _video(self, stem: str) -> None:
            path = app.video_file(stem)
            if not path:
                return self._json(404, {"error": "No video."})
            size = path.stat().st_size
            start, end, status = 0, size - 1, 200
            header = self.headers.get("Range")
            if header:
                m = re.fullmatch(r"bytes=(\d*)-(\d*)", header.strip())
                if not m or not (m[1] or m[2]) or (m[1] and int(m[1]) >= size):
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{size}")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                if m[1]:
                    start, end = int(m[1]), min(int(m[2]) if m[2] else size - 1, size - 1)
                else:
                    start = max(0, size - int(m[2]))
                if end < start:
                    return self._json(400, {"error": "Bad range."})
                status = 206
            self.send_response(status)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(end - start + 1))
            if status == 206:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.end_headers()
            try:
                with path.open("rb") as f:
                    f.seek(start)
                    left = end - start + 1
                    while left > 0 and (chunk := f.read(min(CHUNK, left))):
                        self.wfile.write(chunk)
                        left -= len(chunk)
            except (BrokenPipeError, ConnectionResetError):
                pass  # browsers abandon ranges whenever the viewer seeks

        def do_POST(self) -> None:
            if not self._trusted():
                return self._json(403, {"error": "Local requests only."})
            url = urlsplit(self.path)
            if url.path == "/api/upload":
                return self._upload(parse_qs(url.query))
            m = re.fullmatch(r"/api/answers/([a-z0-9][a-z0-9_-]*)", url.path)
            if m and app.path(m[1], ".lab.json").is_file():
                length = int(self.headers.get("Content-Length") or 0)
                if length > CHUNK:
                    return self._json(413, {"error": "Answers are too long."})
                try:
                    submitted = json.loads(self.rfile.read(length))["answers"]
                    if not isinstance(submitted, list) or not all(isinstance(a, dict) for a in submitted):
                        raise ValueError
                except (ValueError, KeyError, TypeError):
                    return self._json(400, {"error": "Could not read the answers."})
                return self._json(*app.answer(m[1], submitted))
            self._json(404, {"error": "Not found."})

        def _upload(self, query: dict[str, list[str]]) -> None:
            self.close_connection = True  # an early refusal leaves the body unread
            name = query.get("name", [""])[0]
            domain = query.get("domain", ["sorting"])[0]
            length = int(self.headers.get("Content-Length") or 0)
            if not app.has_key():
                return self._json(400, {"error": "Set MODEL_API_KEY first."})
            if domain not in DOMAINS:
                return self._json(400, {"error": "Unknown domain."})
            if not name.lower().endswith(".mp4"):
                return self._json(400, {"error": "Muse Spark video input supports .mp4 only."})
            if not 0 < length <= MAX_UPLOAD_BYTES:
                return self._json(413, {"error": "The video must be under 1 GiB."})
            with app.lock:
                stem = app.unique_stem(name)
                app.jobs[stem] = {"state": "uploading", "log": [], "error": ""}
            target, partial = app.path(stem, ".mp4"), app.path(stem, ".mp4.part")
            try:
                left, head = length, b""
                with partial.open("wb") as f:
                    while left > 0 and (chunk := self.rfile.read(min(CHUNK, left))):
                        head = head or chunk[:12]
                        f.write(chunk)
                        left -= len(chunk)
                if left or head[4:8] != b"ftyp":
                    partial.unlink(missing_ok=True)
                    del app.jobs[stem]
                    return self._json(400, {"error": "That file is not a complete mp4."})
                partial.rename(target)
            except OSError:
                partial.unlink(missing_ok=True)
                del app.jobs[stem]
                raise
            del app.jobs[stem]
            context = unquote(self.headers.get("X-Unwritten-Context", ""))[:2000]
            app.run_clip(stem, domain, context)
            self._json(202, {"stem": stem})

    return Handler


def make_server(app: App, port: int = 8765, host: str = "127.0.0.1") -> ThreadingHTTPServer:
    return ThreadingHTTPServer((host, port), _handler(app))


def serve(workdir: str | Path = DEFAULT_DIR, port: int = 8765) -> None:
    server = make_server(App(workdir), port)
    print(f"Unwritten is running at http://127.0.0.1:{server.server_address[1]}  (Ctrl-C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
