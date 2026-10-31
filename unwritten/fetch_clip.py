"""Download a YouTube clip ONLY if it is published under Creative Commons.

The hackathon disqualifies projects that use assets you lack rights to, and
YouTube's terms forbid downloading most videos. Creative Commons (CC BY) clips
are reusable with attribution, so this helper checks the license first, refuses
anything else, and writes an attribution file next to the clip.
"""
from __future__ import annotations

import json
from pathlib import Path


def fetch(url: str, out_dir: str | Path = "clips", start: float | None = None,
          end: float | None = None) -> Path:
    import yt_dlp

    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    with yt_dlp.YoutubeDL({"quiet": True, "skip_download": True}) as ydl:
        info = ydl.extract_info(url, download=False)
    license_text = (info.get("license") or "").strip()
    if "creative commons" not in license_text.lower():
        raise PermissionError(
            f"Refusing to download: license is '{license_text or 'standard YouTube license'}'. "
            "Use a Creative Commons clip (YouTube search → Filters → Creative Commons) "
            "or film your own video.")

    opts: dict = {
        "quiet": True,
        # Prefer a single file that has sound, then merge separate streams; a bare
        # "mp4" match can be video-only.
        "format": "mp4[height<=720][acodec!=none]/bestvideo[ext=mp4][height<=720]"
                  "+bestaudio[ext=m4a]/mp4",
        "merge_output_format": "mp4",
        "outtmpl": str(out_dir / "%(id)s.%(ext)s"),
    }
    if start is not None or end is not None:
        from yt_dlp.utils import download_range_func
        opts["download_ranges"] = download_range_func(None, [(start or 0, end or info["duration"])])
        opts["force_keyframes_at_cuts"] = True
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([url])

    clip = out_dir / f"{info['id']}.mp4"
    attribution = {
        "title": info.get("title"), "creator": info.get("uploader"),
        "url": info.get("webpage_url", url), "license": license_text,
        "clip_seconds": [start, end],
        "credit_line": f"\"{info.get('title')}\" by {info.get('uploader')} "
                       f"({info.get('webpage_url', url)}), {license_text}.",
    }
    clip.with_suffix(".attribution.json").write_text(json.dumps(attribution, indent=2))
    return clip
