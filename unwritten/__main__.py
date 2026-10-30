"""Command line entry point.

    python -m unwritten serve                               # the app, at localhost:8765
    python -m unwritten observe clip.mp4 --domain sorting   # video → observations.json
    python -m unwritten learn observations.json             # rules, predictions, notebook
    python -m unwritten run clip.mp4                        # both steps
    python -m unwritten fetch <youtube-url> --start 30 --end 150   # CC-licensed clips only
    python -m unwritten eval evals/                         # score against hand labels
    python -m unwritten check                               # verify the API key and model
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
    from .workspace import observe_clip
    return observe_clip(_client(), args.video, args.domain, args.context or "",
                        out_dir=args.out_dir, out=args.out)


def _learn(args, obs_path: Path) -> None:
    from .workspace import learn_clip
    notebook = learn_clip(_client(), obs_path, args.domain, out_dir=args.out_dir,
                          train_fraction=args.train, max_rounds=args.rounds,
                          min_confidence=args.min_confidence)
    print(f"Notebook → {notebook}\nPlayer   → {notebook.with_name(notebook.name.replace('.lab.html', '.live.html'))}")


def _check() -> None:
    client = _client()
    schema = {"type": "object", "properties": {"ok": {"type": "boolean"}}, "required": ["ok"]}
    reply = client.ask_json('Return {"ok": true}.', schema, name="health_check")
    print(f"{client.model} replied: {reply}")


def main() -> None:
    p = argparse.ArgumentParser(prog="unwritten", description="Learn unwritten rules from video.")
    sub = p.add_subparsers(dest="cmd", required=True)

    def common(sp):
        sp.add_argument("--domain", default="sorting", choices=list(DOMAINS))
        sp.add_argument("--out-dir", default="labs")

    o = sub.add_parser("observe"); o.add_argument("video"); common(o)
    o.add_argument("--context"); o.add_argument("--out")

    l = sub.add_parser("learn"); l.add_argument("observations"); common(l)
    r = sub.add_parser("run"); r.add_argument("video"); common(r)
    r.add_argument("--context"); r.add_argument("--out")
    for sp in (l, r):
        sp.add_argument("--train", type=float, default=0.6, help="fraction of events to learn from")
        sp.add_argument("--rounds", type=int, default=3, help="max hypothesis revisions")
        sp.add_argument("--min-confidence", type=float, default=0.0)

    f = sub.add_parser("fetch"); f.add_argument("url")
    f.add_argument("--start", type=float); f.add_argument("--end", type=float)
    f.add_argument("--out-dir", default="clips")

    sub.add_parser("check")

    v = sub.add_parser("serve"); v.add_argument("--dir", default="labs")
    v.add_argument("--port", type=int, default=8765)

    e = sub.add_parser("eval"); e.add_argument("folder", help="folder of <clip>.truth.json files")
    e.add_argument("--labs", default="labs"); e.add_argument("--tolerance", type=float, default=3.0)

    args = p.parse_args()
    if args.cmd == "observe":
        _observe(args)
    elif args.cmd == "learn":
        _learn(args, Path(args.observations))
    elif args.cmd == "run":
        _learn(args, _observe(args))
    elif args.cmd == "serve":
        from .server import serve
        serve(args.dir, args.port)
    elif args.cmd == "eval":
        from .evals import evaluate_folder, format_report
        report = evaluate_folder(args.folder, args.labs, args.tolerance)
        out = Path(args.folder) / "eval_report.json"
        out.write_text(json.dumps(report, indent=2))
        print(f"{format_report(report)}\n\nFull report → {out}")
    elif args.cmd == "check":
        _check()
    elif args.cmd == "fetch":
        from .fetch_clip import fetch
        clip = fetch(args.url, args.out_dir, args.start, args.end)
        print(f"Saved {clip} (attribution in {clip.with_suffix('.attribution.json')})")


if __name__ == "__main__":
    main()
