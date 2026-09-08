"""CPU-only local transcription using faster-whisper."""

import math
import os
import tempfile
from pathlib import Path
from typing import Callable

from settings import settings

_model = None


def get_model():
    """Load the model on first use so the web service can start quickly."""
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        _model = WhisperModel(
            settings.whisper_model,
            device="cpu",
            compute_type="int8",
            cpu_threads=settings.cpu_threads,
            num_workers=1,
        )
    return _model


def _confidence(logprobs: list[float]) -> float:
    if not logprobs:
        return 0.0
    average = sum(logprobs) / len(logprobs)
    return round(math.exp(max(-2.0, min(0.0, average))) * 100, 1)


def transcribe_audio(
    audio_bytes: bytes,
    filename: str,
    progress_cb: Callable[[int], None] | None = None,
    diarize: bool = False,
) -> dict:
    """Transcribe an uploaded recording without persisting it after the request."""
    suffix = Path(filename).suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temporary_file:
        temporary_file.write(audio_bytes)
        temporary_path = temporary_file.name

    try:
        segments, info = get_model().transcribe(
            temporary_path,
            language=None,
            vad_filter=True,
            beam_size=1,
        )
        duration = info.duration or 0
        segment_data: list[dict] = []
        logprobs: list[float] = []
        for segment in segments:
            text = segment.text.strip()
            if not text:
                continue
            segment_data.append(
                {"start": segment.start, "end": segment.end, "text": text}
            )
            logprobs.append(segment.avg_logprob)
            if progress_cb and duration:
                progress_cb(min(95, int(segment.end / duration * 100)))

        if diarize:
            from speaker import apply_generic_speaker_labels

            segment_data = apply_generic_speaker_labels(temporary_path, segment_data)

        transcript = "\n\n".join(
            f"{segment['speaker']}: {segment['text']}"
            if segment.get("speaker")
            else segment["text"]
            for segment in segment_data
        )
        return {
            "text": transcript,
            "confidence": _confidence(logprobs),
            "duration": duration,
            "language": info.language,
            "segments": segment_data,
        }
    finally:
        os.unlink(temporary_path)
