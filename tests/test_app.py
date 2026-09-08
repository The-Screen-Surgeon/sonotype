from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parents[1]))
from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_index():
    response = client.get("/")
    assert response.status_code == 200
    assert "Local Transcription" in response.text


def test_docx_export_rejects_empty():
    response = client.post("/export/docx", data={"transcript": ""})
    assert response.status_code == 400


def test_pdf_export_rejects_empty():
    response = client.post("/export/pdf", data={"transcript": ""})
    assert response.status_code == 400
