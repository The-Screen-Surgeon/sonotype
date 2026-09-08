"""Anonymous, local-only speaker labeling for Sonotype."""

from __future__ import annotations

import os
from pathlib import Path


def label_segments(segments: list[dict], audio_path: Path) -> list[dict]:
    """Attach Speaker 1..N labels by maximum overlap with local diarization turns."""
    model_path = os.getenv("SONOTYPE_DIARIZATION_MODEL")
    if not model_path:
        raise RuntimeError(
            "Speaker diarization is not configured. Set SONOTYPE_DIARIZATION_MODEL "
            "to a local pyannote pipeline directory after installing "
            "requirements-diarization.txt."
        )

    local_pipeline = Path(model_path).expanduser().resolve()
    if not local_pipeline.is_dir():
        raise RuntimeError(
            "SONOTYPE_DIARIZATION_MODEL must point to a local model directory."
        )

    try:
        from pyannote.audio import Pipeline
    except ImportError as exc:
        raise RuntimeError(
            "Optional diarization dependency is missing. "
            "Install requirements-diarization.txt."
        ) from exc

    pipeline = Pipeline.from_pretrained(str(local_pipeline))
    diarization = pipeline(str(audio_path))
    turns = [
        (turn.start, turn.end, label)
        for turn, _, label in diarization.itertracks(yield_label=True)
    ]
    anonymous_labels: dict[str, str] = {}

    for segment in segments:
        start, end = segment["start"], segment["end"]
        overlaps: dict[str, float] = {}
        for turn_start, turn_end, raw_label in turns:
            overlap = max(0.0, min(end, turn_end) - max(start, turn_start))
            if overlap:
                overlaps[raw_label] = overlaps.get(raw_label, 0.0) + overlap
        if overlaps:
            raw_label = max(overlaps, key=overlaps.get)
            if raw_label not in anonymous_labels:
                anonymous_labels[raw_label] = f"Speaker {len(anonymous_labels) + 1}"
            segment["speaker"] = anonymous_labels[raw_label]
    return segments
