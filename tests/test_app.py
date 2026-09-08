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
