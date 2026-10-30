"""Thin wrapper around Meta Model API (OpenAI-compatible Responses API).

Every model call in Unwritten goes through `MetaClient.ask_json`, which asks
Muse Spark for output constrained to a JSON schema. Video is uploaded once via
the Files API and then referenced by file_id.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Protocol

DEFAULT_BASE_URL = "https://api.meta.ai/v1"
DEFAULT_MODEL = "muse-spark-1.3"
UPLOAD_TTL_SECONDS = 7 * 24 * 3600  # uploaded clips expire after a week
MAX_UPLOAD_BYTES = 1024 ** 3  # Files API limit


class ModelClient(Protocol):
    """Interface the engine depends on. Tests use a fake implementation."""

    def upload_video(self, path: str | Path) -> str: ...

    def ask_json(
        self,
        prompt: str,
        schema: dict[str, Any],
        name: str,
        video: str | None = None,
    ) -> dict[str, Any]: ...


def load_dotenv(path: str | Path = ".env") -> None:
    """Read KEY=value lines into the environment; real env vars win."""
    path = Path(path)
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip().removeprefix("export ").strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def _extract_json(text: str) -> dict[str, Any]:
    """Parse JSON even if the model wrapped it in prose or a code fence."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    if fenced:
        return json.loads(fenced.group(1))
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        return json.loads(text[start : end + 1])
    raise ValueError(f"Model did not return JSON: {text[:300]!r}")


class MetaClient:
    """Calls Muse Spark through Meta Model API."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
        reasoning_effort: str = "high",
        max_output_tokens: int = 32000,
    ) -> None:
        from openai import OpenAI  # imported lazily so tests don't need it

        load_dotenv()
        key = api_key or os.environ.get("MODEL_API_KEY")
        if not key:
            raise RuntimeError("Set MODEL_API_KEY to your Meta Model API key (env var or .env file).")
        self.model = model or os.environ.get("UNWRITTEN_MODEL", DEFAULT_MODEL)
        self.reasoning_effort = reasoning_effort
        self.max_output_tokens = max_output_tokens
        self._client = OpenAI(
            base_url=base_url or os.environ.get("MODEL_API_BASE", DEFAULT_BASE_URL),
            api_key=key,
        )

    def upload_video(self, path: str | Path) -> str:
        path = Path(path)
        if path.suffix.lower() != ".mp4":
            raise ValueError("Muse Spark video input supports .mp4 only.")
        if path.stat().st_size > MAX_UPLOAD_BYTES:
            raise ValueError("Muse Spark video uploads are limited to 1 GiB.")
        with path.open("rb") as f:
            uploaded = self._client.files.create(
                purpose="user_data",
                expires_after={"anchor": "created_at", "seconds": UPLOAD_TTL_SECONDS},
                file=f,
            )
        return uploaded.id

    def ask_json(
        self,
        prompt: str,
        schema: dict[str, Any],
        name: str,
        video: str | None = None,
    ) -> dict[str, Any]:
        content: list[dict[str, Any]] = [{"type": "input_text", "text": prompt}]
        if video:
            if video.startswith(("http://", "https://")):
                content.append({"type": "input_video", "video_url": video})
            else:
                content.append({"type": "input_file", "file_id": video})

        response = self._client.responses.create(
            model=self.model,
            input=[{"type": "message", "role": "user", "content": content}],
            text={"format": {"type": "json_schema", "name": name, "schema": schema}},
            reasoning={"effort": self.reasoning_effort},
            max_output_tokens=self.max_output_tokens,
        )
        if getattr(response, "status", None) == "incomplete":
            raise RuntimeError(f"Model output was cut off ({response.incomplete_details}); "
                               "raise max_output_tokens or use a shorter clip.")
        return _extract_json(response.output_text)
