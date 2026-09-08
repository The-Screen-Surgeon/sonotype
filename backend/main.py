"""Local HTTP service for browser-based transcription."""

import asyncio
import json
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles

from export import generate_docx, generate_pdf
from settings import settings
from transcribe import transcribe_audio

app = FastAPI(title="PrivateScribe", version="0.1.0")

ALLOWED_EXTENSIONS = {
    "webm", "wav", "mp3", "ogg", "m4a", "aac", "flac", "opus",
    "mp4", "mov", "avi", "mkv", "wmv", "mpeg", "mpg", "ts", "mts",
}
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


def _safe_filename(filename: str, extension: str) -> str:
    stem = "".join(character for character in Path(filename).stem if character.isalnum() or character in "-_ ").strip()
    return f"private-scribe-{stem or 'transcript'}.{extension}".replace(" ", "-")


def _duration_label(seconds: float | None) -> str:
    if not seconds:
        return ""
    minutes, remainder = divmod(round(seconds), 60)
    return f"{minutes}:{remainder:02d}"


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "processing": "local CPU", "model": settings.whisper_model}


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...), diarize: bool = Form(False)):
    extension = Path(audio.filename or "").suffix.lower().lstrip(".")
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported audio or video file type.")
    data = await audio.read()
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File is larger than the {settings.max_upload_mb} MB local limit.")

    queue: asyncio.Queue[dict] = asyncio.Queue()
    event_loop = asyncio.get_running_loop()

    def send(event: dict) -> None:
        event_loop.call_soon_threadsafe(queue.put_nowait, event)

    def run() -> None:
        try:
            result = transcribe_audio(
                data,
                audio.filename or "recording.webm",
                progress_cb=lambda percent: send({"type": "progress", "percent": percent}),
                diarize=diarize,
            )
            send({"type": "done", **result})
        except Exception as error:
            send({"type": "error", "message": str(error)})

    async def stream():
        event_loop.run_in_executor(None, run)
        while True:
            event = await queue.get()
            yield f"data: {json.dumps(event)}\n\n"
            if event["type"] in {"done", "error"}:
                break

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@app.post("/export/{format_name}")
async def export(
    format_name: str,
    transcript: str = Form(...),
    source_name: str = Form(""),
    confidence: str = Form(""),
    duration: str = Form(""),
):
    if not transcript.strip():
        raise HTTPException(status_code=400, detail="Add transcript text before exporting.")
    if format_name == "docx":
        content = generate_docx(transcript, source_name, confidence, duration)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif format_name == "pdf":
        content = generate_pdf(transcript, source_name, confidence, duration)
        media_type = "application/pdf"
    else:
        raise HTTPException(status_code=404, detail="Export format not found.")
    return Response(content=content, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{_safe_filename(source_name, format_name)}"'})


app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
