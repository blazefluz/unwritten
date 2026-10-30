"""Files on disk for each clip, shared by the CLI and the app.

    labs/<stem>.observations.json   what the model logged
    labs/<stem>.lab.json            rules, predictions, questions, revisions
    labs/<stem>.lab.html            notebook
    labs/<stem>.live.html           predict-before-it-happens player
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from urllib.parse import quote

from .client import ModelClient
from .learner import LabResult, Log, observe, run_lab
from .live import render_live
from .report import write
from .sample import SAMPLE_FIXTURE, SAMPLE_STEM, ScriptedClient

DEFAULT_DIR = "labs"


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9_-]+", "-", Path(name).stem.lower()).strip("-_") or "clip"


def observe_clip(client: ModelClient, src: str, domain: str, context: str = "",
                 out_dir: str | Path = DEFAULT_DIR, out: str | None = None,
                 log: Log = print) -> Path:
    video = src if src.startswith(("http://", "https://")) else client.upload_video(src)
    log(f"Watching {src} with Muse Spark…")
    obs = observe(client, video, domain, context)
    obs["source"] = src
    path = Path(out) if out else Path(out_dir) / f"{slug(src)}.observations.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obs, indent=2, ensure_ascii=False))
    log(f"Logged {len(obs['events'])} events → {path}")
    return path


def learn_clip(client: ModelClient, obs_path: str | Path, domain: str,
               out_dir: str | Path = DEFAULT_DIR, train_fraction: float = 0.6,
               max_rounds: int = 3, min_confidence: float = 0.0, log: Log = print) -> Path:
    obs_path = Path(obs_path)
    obs = json.loads(obs_path.read_text())
    result = run_lab(client, obs, domain=domain, source=obs.get("source", str(obs_path)),
                     train_fraction=train_fraction, max_rounds=max_rounds,
                     min_confidence=min_confidence, log=log)
    return save_lab(result, obs_path.name.replace(".observations.json", ""), out_dir)


def static_video_src(source: str, out_dir: Path) -> str | None:
    """How a saved page should reference the clip, or None if there is no video."""
    if source.startswith("https://"):
        return source
    if source.lower().endswith(".mp4") and Path(source).is_file():
        return quote(os.path.relpath(source, out_dir))
    return None


def save_lab(result: LabResult, stem: str, out_dir: str | Path = DEFAULT_DIR) -> Path:
    """Write the record, the notebook and the player; return the notebook path."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / f"{stem}.lab.json").write_text(
        json.dumps(result.to_dict(), indent=2, ensure_ascii=False))
    (out_dir / f"{stem}.live.html").write_text(
        render_live(result, static_video_src(result.source, out_dir),
                    notebook_href=f"{stem}.lab.html"), encoding="utf-8")
    return write(result, out_dir / f"{stem}.lab.html", live_href=f"{stem}.live.html")


def load_lab(stem: str, out_dir: str | Path = DEFAULT_DIR) -> LabResult:
    return LabResult.from_dict(json.loads((Path(out_dir) / f"{stem}.lab.json").read_text()))


def build_sample(out_dir: str | Path = DEFAULT_DIR, log: Log = lambda _: None) -> Path:
    """Create the synthetic demo lab, which needs no API key and no video."""
    obs = json.loads(SAMPLE_FIXTURE.read_text())
    result = run_lab(ScriptedClient(), obs, source=obs["source"], log=log)
    result.synthetic = True
    return save_lab(result, SAMPLE_STEM, out_dir)
