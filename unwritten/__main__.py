"""Command line entry point.

    python -m unwritten observe clip.mp4 --domain sorting   # video → observations.json
    python -m unwritten learn observations.json             # rules, predictions, notebook
    python -m unwritten run clip.mp4                        # both steps
    python -m unwritten play clip.lab.json --video clip.mp4 # prediction player
    python -m unwritten fetch <youtube-url> --start 30 --end 150   # CC-licensed clips only
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from urllib.parse import quote

from .prompts import DOMAINS


def _client():
    from .client import MetaClient
    return MetaClient()


def _observe(args) -> Path:
    from .learner import observe
    client = _client()
    src = args.video
    video = src if src.startswith(("http://", "https://")) else client.upload_video(src)
    print(f"Watching {src} with Muse Spark…")
    obs = observe(client, video, args.domain, args.context or "")
    obs["source"] = src
    # Local clips get their outputs next to them; URLs fall back to the current folder.
    default = Path(src).with_suffix(".observations.json")
    out = Path(args.out or (default if Path(src).is_file() else default.name))
    out.write_text(json.dumps(obs, indent=2, ensure_ascii=False))
    print(f"Logged {len(obs['events'])} events → {out}")
    return out


def _learn(args, obs_path: Path) -> None:
    from .learner import run_lab
    from .report import write
    obs = json.loads(Path(obs_path).read_text())
    result = run_lab(_client(), obs, domain=args.domain, source=obs.get("source", str(obs_path)),
                     train_fraction=args.train, max_rounds=args.rounds,
                     min_confidence=args.min_confidence)
    stem = Path(obs_path).parent / Path(obs_path).name.replace(".observations.json", "")
    lab = result.to_dict()
    Path(f"{stem}.lab.json").write_text(json.dumps(lab, indent=2, ensure_ascii=False))
    print(f"Notebook → {write(result, f'{stem}.lab.html')}")
    _play(lab, f"{stem}.player.html", getattr(args, "video", None) or obs.get("source"))


def _play(lab: dict, out: str, video: str | None) -> None:
    from . import player
    if video and not Path(video).is_file():
        video = None  # a URL or missing file: fall back to the simulated clock
    print(f"Prediction player → {player.write(lab, out, video)}")


def _analyze(args) -> None:
    from .workflow import analyze, load_references, render

    if bool(args.video) == bool(args.observations):
        raise ValueError("Supply either a video or --observations, not both.")
    if not 1 <= args.rounds <= 3:
        raise ValueError("--rounds must be between 1 and 3.")
    references = load_references(args.reference, args.reference_scope)
    answers = json.loads(Path(args.answers).read_text()) if args.answers else {}
    if not isinstance(answers, dict) or any(not isinstance(k, str) or not isinstance(v, str)
                                          for k, v in answers.items()):
        raise ValueError("--answers must map full expert question text to text answers.")
    observation = json.loads(Path(args.observations).read_text()) if args.observations else None
    if observation is not None and observation.get("kind") != "workflow_observations":
        raise ValueError("--observations requires a saved workflow observation file.")
    source = args.video or observation.get("source", args.observations)
    if args.out:
        stem = Path(args.out)
    elif args.observations:
        stem = Path(str(args.observations).removesuffix(".workflow.observations.json"))
    else:
        stem = Path(args.video).with_suffix("")
    stem.parent.mkdir(parents=True, exist_ok=True)
    if any(Path(f"{stem}{suffix}").exists() for suffix in (".workflow.json", ".workflow.html")):
        raise ValueError("Workflow output already exists; use --out with a new prefix to preserve the previous review.")
    if args.video and (not Path(args.video).is_file() or Path(args.video).suffix.lower() != ".mp4"):
        raise ValueError("Supply a local .mp4 video.")
    # Check filesystem and inputs before a paid model call; save perception before
    # reasoning so a retry need not upload or watch the video again.
    def save_observations(value):
        Path(f"{stem}.workflow.observations.json").write_text(
            json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")

    client = _client()
    video = None
    if args.video:
        video = client.upload_video(args.video)
    result = analyze(client, task=args.task, source=source, video=video,
                     observation=observation, references=references, answers=answers,
                     rounds=args.rounds, on_observed=save_observations)
    Path(f"{stem}.workflow.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    report_path = Path(f"{stem}.workflow.html")
    video_src = (quote(os.path.relpath(Path(source).resolve(), report_path.parent.resolve()))
                 if Path(source).is_file() and Path(source).suffix.lower() == ".mp4" else None)
    report_path.write_text(render(result, video_src=video_src), encoding="utf-8")
    print(f"Workflow review → {report_path}")
    print("Citation provenance checked in code. Interpretations require expert review.")


def main() -> None:
    p = argparse.ArgumentParser(prog="unwritten", description="Learn unwritten rules from video.")
    sub = p.add_subparsers(dest="cmd", required=True)

    def common(sp):
        sp.add_argument("--domain", default="sorting", choices=list(DOMAINS))

    o = sub.add_parser("observe"); o.add_argument("video"); common(o)
    o.add_argument("--context"); o.add_argument("--out")

    l = sub.add_parser("learn"); l.add_argument("observations"); common(l)
    r = sub.add_parser("run"); r.add_argument("video"); common(r)
    r.add_argument("--context"); r.add_argument("--out")
    for sp in (l, r):
        sp.add_argument("--train", type=float, default=0.6, help="fraction of events to learn from")
        sp.add_argument("--rounds", type=int, default=3, help="max hypothesis revisions")
        sp.add_argument("--min-confidence", type=float, default=0.0)

    pl = sub.add_parser("play", help="replay the clip with predictions shown before each placement")
    pl.add_argument("lab"); pl.add_argument("--video"); pl.add_argument("--out")

    f = sub.add_parser("fetch"); f.add_argument("url")
    f.add_argument("--start", type=float); f.add_argument("--end", type=float)
    f.add_argument("--out-dir", default="clips")

    a = sub.add_parser("analyze", help="observe any task, infer principles, and review against references")
    a.add_argument("video", nargs="?", help="local .mp4 file")
    a.add_argument("--task", required=True, help="task, equipment, situation and intended outcome")
    a.add_argument("--observations", help="reuse a saved .workflow.observations.json")
    a.add_argument("--reference", action="append", default=[], help="UTF-8 .txt/.md excerpt; repeatable")
    a.add_argument("--reference-scope", default="", help="reference equipment/model/version and applicability")
    a.add_argument("--answers", help="JSON object mapping full question text to expert answers")
    a.add_argument("--rounds", type=int, default=2, help="review/revision rounds, 1–3")
    a.add_argument("--out", help="output path prefix")

    args = p.parse_args()
    if args.cmd == "observe":
        _observe(args)
    elif args.cmd == "learn":
        _learn(args, Path(args.observations))
    elif args.cmd == "run":
        _learn(args, _observe(args))
    elif args.cmd == "play":
        lab = json.loads(Path(args.lab).read_text())
        out = args.out or str(Path(args.lab)).replace(".lab.json", "") + ".player.html"
        _play(lab, out, args.video or lab.get("source"))
    elif args.cmd == "fetch":
        from .fetch_clip import fetch
        clip = fetch(args.url, args.out_dir, args.start, args.end)
        print(f"Saved {clip} (attribution in {clip.with_suffix('.attribution.json')})")
    elif args.cmd == "analyze":
        try:
            _analyze(args)
        except (ValueError, OSError) as exc:
            p.error(str(exc))


if __name__ == "__main__":
    main()
