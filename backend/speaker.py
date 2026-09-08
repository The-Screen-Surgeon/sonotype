"""Optional, local-only speaker diarization with generic labels."""

import os

from settings import settings


def _overlap(left_start: float, left_end: float, right_start: float, right_end: float) -> float:
    return max(0.0, min(left_end, right_end) - max(left_start, right_start))


def apply_generic_speaker_labels(audio_path: str, segments: list[dict]) -> list[dict]:
    """Assign Speaker 1, Speaker 2, etc.; source speaker identities are discarded."""
    try:
        from pyannote.audio import Pipeline
        import torch
    except ImportError as error:
        raise RuntimeError(
            "Speaker diarization is optional. Install requirements-diarization.txt first."
        ) from error

    token = os.getenv("LOCAL_TRANSCRIBER_HF_TOKEN")
    if not token:
        raise RuntimeError(
            "Speaker diarization needs a Hugging Face access token to download its local model. "
            "Set PRIVATE_SCRIBE_HF_TOKEN outside this project and restart the server."
        )

    pipeline = Pipeline.from_pretrained(settings.diarization_model, use_auth_token=token)
    pipeline.to(torch.device("cpu"))
    diarization = pipeline(audio_path)
    turns = [
        (turn.start, turn.end, source_label)
        for turn, _, source_label in diarization.itertracks(yield_label=True)
    ]
    labels: dict[str, str] = {}
    for segment in segments:
        best = max(
            turns,
            key=lambda turn: _overlap(segment["start"], segment["end"], turn[0], turn[1]),
            default=None,
        )
        if best is not None:
            source_label = best[2]
            labels.setdefault(source_label, f"Speaker {len(labels) + 1}")
            segment["speaker"] = labels[source_label]
    return segments
