from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parents[1] / "backend"))
from main import app

client = TestClient(app)


def test_health_reports_local_cpu_processing():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["processing"] == "local CPU"


def test_frontend_is_served():
    response = client.get("/")
    assert response.status_code == 200
    assert "Local Transcription" in response.text


def test_docx_export_is_a_document():
    response = client.post("/export/docx", data={"transcript": "A short local transcript.", "source_name": "sample.webm"})
    assert response.status_code == 200
    assert response.content.startswith(b"PK")


def test_pdf_export_is_a_pdf():
    response = client.post("/export/pdf", data={"transcript": "A short local transcript.", "source_name": "sample.webm"})
    assert response.status_code == 200
    assert response.content.startswith(b"%PDF")
