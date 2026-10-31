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
from pathlib import Path

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
    out = Path(args.out or Path(src).with_suffix(".observations.json").name)
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
    stem = Path(obs_path).name.replace(".observations.json", "")
    lab = result.to_dict()
    Path(f"{stem}.lab.json").write_text(json.dumps(lab, indent=2, ensure_ascii=False))
    print(f"Notebook → {write(result, f'{stem}.lab.html')}")
    _play(lab, f"{stem}.player.html", getattr(args, "video", None) or obs.get("source"))


def _play(lab: dict, out: str, video: str | None) -> None:
    from . import player
    if video and not Path(video).is_file():
        video = None  # a URL or missing file: fall back to the simulated clock
    print(f"Prediction player → {player.write(lab, out, video)}")


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

    args = p.parse_args()
    if args.cmd == "observe":
        _observe(args)
    elif args.cmd == "learn":
        _learn(args, Path(args.observations))
    elif args.cmd == "run":
        _learn(args, _observe(args))
    elif args.cmd == "play":
        lab = json.loads(Path(args.lab).read_text())
        out = args.out or Path(args.lab).name.replace(".lab.json", "") + ".player.html"
        _play(lab, out, args.video or lab.get("source"))
    elif args.cmd == "fetch":
        from .fetch_clip import fetch
        clip = fetch(args.url, args.out_dir, args.start, args.end)
        print(f"Saved {clip} (attribution in {clip.with_suffix('.attribution.json')})")


if __name__ == "__main__":
    main()
