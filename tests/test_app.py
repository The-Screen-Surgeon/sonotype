from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parents[1]))
from app.main import app


client = TestClient(app)


def test_health_endpoint_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["mode"] == "local-only"


def test_index_page_is_sonotype_html():
    response = client.get("/")
    assert response.status_code == 200
    assert "<title>Sonotype" in response.text


def test_index_page_matches_focused_record_library_ui():
    response = client.get("/")
    assert "Local AI transcription" in response.text
    assert 'data-view="record"' in response.text
    assert 'data-view="library"' in response.text
    assert "Record locally" in response.text
    assert "Upload audio or video" in response.text
    assert "YouTube URL" in response.text
    assert "Stop &amp; Transcribe" in response.text
    assert "Save transcription" in response.text
    assert "Workspace" not in response.text
    assert "side-menu" not in response.text


def test_export_endpoints_reject_empty_transcripts():
    for endpoint in ("/export/docx", "/export/pdf"):
        response = client.post(endpoint, data={"transcript": "   "})
        assert response.status_code == 400
        assert response.json()["detail"] == "A transcript is required."


def test_youtube_endpoint_rejects_non_youtube_url():
    response = client.post("/transcribe/youtube", data={"url": "https://example.com/video", "diarize": "false"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Enter a valid YouTube URL."


def test_file_upload_rejects_unsupported_extension():
    response = client.post("/transcribe", data={"diarize": "false"}, files={"media": ("notes.txt", b"not media", "text/plain")})
    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported audio or video file type."


def test_download_page_has_current_platform_release_links():
    page = (Path(__file__).parents[1] / "landing" / "index.html").read_text(encoding="utf-8")
    for asset in (
        "Sonotype-Windows-x64.zip",
        "Sonotype-Linux-x64.tar.gz",
        "Sonotype-macOS-arm64.zip",
        "Sonotype-macOS-x64.zip",
    ):
        assert f"releases/latest/download/{asset}" in page
    assert "No cloud upload" in page
    assert "No telemetry" in page


def test_pyinstaller_spec_collects_faster_whisper_assets():
    spec = (Path(__file__).parents[1] / "sonotype.spec").read_text(encoding="utf-8")
    assert 'collect_data_files("faster_whisper")' in spec
