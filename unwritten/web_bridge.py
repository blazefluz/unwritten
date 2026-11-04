"""Local Next.js bridge. Input paths are created by the local route handler."""
from __future__ import annotations

import json
import sys
from pathlib import Path

from .client import MetaClient
from .workflow import analyze, load_references, load_transcript


def run(request):
    if request.get("operation") == "studio_car":
        from .studio import propose_car
        return propose_car(MetaClient(max_output_tokens=16000, timeout=90, max_retries=0), request)
    if request.get("operation") in ("studio", "studio_photo"):
        from .studio import propose, propose_photo
        try:
            if request["operation"] == "studio_photo":
                return propose_photo(MetaClient(max_output_tokens=24000, timeout=180, max_retries=0), request)
            return propose(MetaClient(max_output_tokens=16000, timeout=90, max_retries=0), request)
        except Exception as exc:
            # Return a bounded category, never provider text, credentials or request data.
            status = getattr(exc, "status_code", None)
            name = type(exc).__name__
            if status in (401, 403):
                category = "authentication"
            elif status == 429:
                category = "rate_limit"
            elif "Timeout" in name:
                category = "timeout"
            elif isinstance(exc, (ValueError, json.JSONDecodeError)):
                category = "invalid_response"
            elif status is not None and status >= 500:
                category = "provider_unavailable"
            else:
                category = "request_failed"
            return {"bridge_error": category}
    if request.get("operation") == "training":
        from . import training
        store = Path(__file__).resolve().parents[1] / ".unwritten-runs" / "training"
        action = request["action"]
        try:
            if action == "propose":
                return training.propose(MetaClient(), request["project"])
            if action == "revise":
                return training.propose(MetaClient(), request["project"], previous=request["study"])
            if action == "inspect":
                return training.inspect(request["project"], request["study"])
            if action == "freeze":
                frozen = training.freeze(request["project"], request["study"],
                    request["rule_id"], request["reviewer"], request["review_note"],
                    request.get("approval_type", "demo"), store=store)
                return {"frozen": frozen, "markdown": training.guide_markdown(frozen)}
            if action == "validate":
                return training.validate_frozen(request["freeze_id"], request["project"], store=store)
            raise ValueError("Unknown guide operation.")
        except ValueError as exc:
            return {"error": str(exc)}
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
