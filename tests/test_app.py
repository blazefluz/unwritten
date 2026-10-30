"""Offline tests for the player and the local app, with a fake model and a fake mp4."""
import json
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest

from tests.test_engine import FIXED, FIXTURE, INCOMPLETE, QUESTIONS, FakeClient, obs
from unwritten.learner import run_lab
from unwritten.live import render_live
from unwritten.report import SYNTHETIC_BANNER, render
from unwritten.server import App, make_server
from unwritten.workspace import build_sample, load_lab, slug, static_video_src

MP4 = b"\x00\x00\x00\x18ftypmp42" + b"x" * 1000


@pytest.fixture
def app_url(tmp_path):
    replies = [json.loads(FIXTURE.read_text()), INCOMPLETE, FIXED, QUESTIONS, FIXED, {"questions": []}]
    fake = FakeClient(replies)
    app = App(tmp_path / "labs", client_factory=lambda: fake)
    server = make_server(app, port=0)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}", app, fake
    server.shutdown()
    server.server_close()


def call(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status, r.read(), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


def wait_for_job(url, stem):
    for _ in range(100):
        job = json.loads(call(f"{url}/api/jobs/{stem}")[1])
        if job["state"] != "running":
            return job
        time.sleep(0.02)
    raise AssertionError("job did not finish")


def lab():
    return run_lab(FakeClient([INCOMPLETE, FIXED, QUESTIONS]), obs(), source="clip.mp4", log=lambda *_: None)


def embedded(page):
    return json.loads(page.split('<script id="lab" type="application/json">')[1].split("</script>")[0])


def test_player_marks_only_held_out_events_as_predictions():
    result = lab()
    data = embedded(render_live(result, "clip.mp4"))
    phases = [e["phase"] for e in data["events"]]
    assert phases.count("test") == len(result.test) and phases.count("train") == len(result.train)
    assert all("predicted" in e for e in data["events"] if e["phase"] == "test")
    assert not any("predicted" in e for e in data["events"] if e["phase"] == "train")
    assert data["cut"] == result.test[0].time_start


def test_player_cannot_be_broken_out_of_by_model_text():
    result = lab()
    result.test[0].item = "</script><script>alert(1)</script>"
    result.final.summary = "<img src=x onerror=alert(1)>"
    page = render_live(result, None)
    assert "<script>alert(1)" not in page and "<img src=x" not in page


def test_sample_is_labelled_synthetic_everywhere(tmp_path):
    notebook = build_sample(tmp_path)
    assert SYNTHETIC_BANNER in notebook.read_text()
    assert SYNTHETIC_BANNER in (tmp_path / "sample.live.html").read_text()
    assert load_lab("sample", tmp_path).synthetic is True
    assert SYNTHETIC_BANNER not in render(lab())


def test_static_video_path_is_relative_to_the_page(tmp_path):
    clip = tmp_path / "my clip.mp4"
    clip.write_bytes(MP4)
    assert static_video_src(str(clip), tmp_path) == "my%20clip.mp4"
    assert static_video_src(str(tmp_path / "missing.mp4"), tmp_path) is None
    assert static_video_src("fixtures/parcels", tmp_path) is None


def test_slug_cannot_escape_the_folder():
    assert slug("../../etc/Pass Wd.mp4") == "pass-wd"
    assert slug("???.mp4") == "clip"


def test_home_explains_a_missing_key_and_refuses_upload(tmp_path, monkeypatch):
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    monkeypatch.chdir(tmp_path)  # no .env here
    server = make_server(App(tmp_path / "labs"), port=0)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        assert b"MODEL_API_KEY" in call(url)[1]
        status, body, _ = call(f"{url}/api/upload?name=a.mp4", MP4, method="POST")
        assert status == 400 and b"MODEL_API_KEY" in body
        # the sample still works without a key
        assert call(f"{url}/lab/sample")[0] == 200
    finally:
        server.shutdown()
        server.server_close()


def test_upload_runs_the_pipeline_then_answers_rescore(app_url):
    url, app, fake = app_url
    status, body, _ = call(f"{url}/api/upload?name=My%20Clip.mp4&domain=sorting", MP4, method="POST",
                           headers={"X-Unwritten-Context": "returns%20desk"})
    assert status == 202
    stem = json.loads(body)["stem"]
    assert stem == "my-clip"
    assert wait_for_job(url, stem)["state"] == "done"
    assert "returns desk" in fake.prompts[0][1]

    page = call(f"{url}/lab/{stem}")[1].decode()
    data = embedded(page)
    assert data["video"] == f"/video/{stem}" and data["stem"] == stem and data["questions"]
    assert call(f"{url}/lab/{stem}/notebook")[0] == 200

    bad = call(f"{url}/api/answers/{stem}", json.dumps({"answers": [{"index": 99, "answer": "x"}]}).encode(), method="POST")
    assert bad[0] == 400
    good = call(f"{url}/api/answers/{stem}", json.dumps({"answers": [{"index": 0, "answer": "Heavy cart."}]}).encode(), method="POST")
    assert good[0] == 202
    assert wait_for_job(url, stem)["state"] == "done"
    saved = json.loads((app.workdir / f"{stem}.lab.json").read_text())
    assert saved["revisions"][0]["answers"][0]["answer"] == "Heavy cart."
    assert saved["questions"] == []


def test_failed_job_reports_the_error(tmp_path):
    fake = FakeClient([{"outcomes": [], "attribute_glossary": [], "events": []}])
    server = make_server(App(tmp_path, client_factory=lambda: fake), port=0)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        call(f"{url}/api/upload?name=a.mp4", MP4, method="POST")
        job = wait_for_job(url, "a")
        assert job["state"] == "error" and "Need at least" in job["error"]
    finally:
        server.shutdown()
        server.server_close()


def test_upload_rejects_non_mp4_content(app_url):
    url, app, _ = app_url
    assert call(f"{url}/api/upload?name=a.mp4", b"not a video at all", method="POST")[0] == 400
    assert call(f"{url}/api/upload?name=a.mov", MP4, method="POST")[0] == 400
    assert not list(Path(app.workdir).glob("a*"))


def test_video_supports_range_requests_for_seeking(app_url):
    url, app, _ = app_url
    (app.workdir / "clip.mp4").write_bytes(MP4)
    size = len(MP4)
    status, body, headers = call(f"{url}/video/clip", headers={"Range": "bytes=4-7"})
    assert status == 206 and body == b"ftyp" and headers["Content-Range"] == f"bytes 4-7/{size}"
    status, body, _ = call(f"{url}/video/clip", headers={"Range": "bytes=-3"})
    assert status == 206 and body == b"xxx"
    assert call(f"{url}/video/clip", headers={"Range": f"bytes={size}-"})[0] == 416
    status, body, _ = call(f"{url}/video/clip")
    assert status == 200 and body == MP4


@pytest.mark.parametrize("headers", [{"Host": "evil.example"},
                                     {"Origin": "https://evil.example"}])
def test_other_sites_cannot_spend_credits(app_url, headers):
    url, _, fake = app_url
    assert call(f"{url}/api/upload?name=a.mp4", MP4, method="POST", headers=headers)[0] == 403
    assert fake.prompts == []


@pytest.mark.parametrize("path", ["/video/..%2f..%2fsecret", "/lab/..%2fsecret", "/lab/missing", "/nope"])
def test_paths_outside_the_app_are_not_found(app_url, path):
    url, _, _ = app_url
    assert call(url + path)[0] == 404
