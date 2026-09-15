from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parents[1]))
from app import main as main_module
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
        "Sonotype-Setup-Windows-x64.exe",
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


def test_library_endpoint_persists_entries_outside_the_webview(tmp_path, monkeypatch):
    library_path = tmp_path / "library.json"
    monkeypatch.setattr(main_module, "LIBRARY_PATH", library_path)
    entries = [{
        "id": "test-entry",
        "name": "meeting.txt",
        "format": "TXT",
        "text": "[00:00] Test transcript",
        "confidence": "Confidence: 91%",
        "savedAt": "2026-09-15T15:00:00Z",
    }]

    response = client.put("/library", json=entries)

    assert response.status_code == 200
    assert response.json() == entries
    assert client.get("/library").json() == entries
    assert '"meeting.txt"' in library_path.read_text(encoding="utf-8")


def test_desktop_launcher_uses_persistent_webview_storage():
    desktop = (Path(__file__).parents[1] / "desktop.py").read_text(encoding="utf-8")
    assert "private_mode=False" in desktop
    assert "storage_path=str(webview_storage_dir())" in desktop


def test_runtime_endpoint_tracks_model_state(tmp_path, monkeypatch):
    state_path = tmp_path / "model-state.json"
    monkeypatch.setattr(main_module, "MODEL_STATE_PATH", state_path)
    monkeypatch.setattr(main_module, "WHISPER_MODEL", "unit-test-model")

    assert client.get("/runtime").json()["model_ready"] is False
    state_path.write_text('{"model": "unit-test-model", "ready": true}', encoding="utf-8")
    assert client.get("/runtime").json()["model_ready"] is True


def test_windows_installer_is_per_user_and_keeps_app_data_separate():
    installer = (Path(__file__).parents[1] / "installer" / "Sonotype.iss").read_text(encoding="utf-8")
    assert "DefaultDirName={localappdata}\\Programs\\Sonotype" in installer
    assert "PrivilegesRequired=lowest" in installer
    assert "Source: \"..\\dist\\Sonotype.exe\"" in installer


def test_logos_use_cream_background_with_forest_waveform():
    for logo_path in (
        Path(__file__).parents[1] / "static" / "logo.svg",
        Path(__file__).parents[1] / "landing" / "logo.svg",
        Path(__file__).parents[1] / "docs" / "logo.svg",
    ):
        logo = logo_path.read_text(encoding="utf-8")
        assert 'fill="#f7f5ef"' in logo, f"{logo_path.name} must use the cream background"
        assert 'fill="#315d45"' in logo, f"{logo_path.name} must use forest waveform bars"
        assert 'fill="#fff"' not in logo, f"{logo_path.name} must not keep white bars"


def test_record_button_symbol_is_css_drawn_not_a_text_glyph():
    index = (Path(__file__).parents[1] / "static" / "index.html").read_text(encoding="utf-8")
    app_js = (Path(__file__).parents[1] / "static" / "app.js").read_text(encoding="utf-8")
    styles = (Path(__file__).parents[1] / "static" / "styles.css").read_text(encoding="utf-8")

    assert 'class="record-button-symbol" aria-hidden="true"></span>' in index
    assert "Ⅱ" not in app_js
    assert "●" not in app_js
    assert ".record-button.recording .record-button-symbol::before" in styles
    assert ".record-button.paused .record-button-symbol::before" in styles
