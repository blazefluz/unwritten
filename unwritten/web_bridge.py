"""Local Next.js bridge. Input paths are created by the local route handler."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from .client import MetaClient
from .workflow import analyze, load_references, load_transcript


def run(request):
    client = MetaClient()
    if request.get("operation") == "decisions":
        from .decisions import evaluate
        return evaluate(client, request["observation"], request["labels"],
                        train_fraction=request.get("train_fraction", 0.6))
    if request.get("operation") == "review":
        previous = request["workflow"]
        result = analyze(client, task=previous["task"], source=previous["source"],
                         observation={"events": previous["events"]},
                         references=previous["references"], answers=request["answers"],
                         transcript=previous.get("transcript"))
        result["attempts"] = previous["attempts"] + result["attempts"]
        return result
    refs = load_references(request.get("references", []), request.get("scope", ""))
    video = client.upload_video(request["video"])
    result = analyze(client, task=request["task"], source=request["source"],
                     video=video, references=refs,
                     transcript=load_transcript(request["transcript"]) if request.get("transcript") else None,
                     on_observed=lambda obs: Path(request["observations"]).write_text(
                         json.dumps(obs, indent=2), encoding="utf-8"))
    Path(request["output"]).write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result


if __name__ == "__main__":
    try:
        print(json.dumps(run(json.loads(sys.stdin.read()))))
    except Exception as exc:
        print(f"Analysis failed ({type(exc).__name__}). Check API access and the local inputs.", file=sys.stderr)
        sys.exit(1)
