"""Small, dependency-free local configuration loader."""

from dataclasses import dataclass
from pathlib import Path
import os
import tomllib

PROJECT_DIR = Path(__file__).parent.parent


@dataclass(frozen=True)
class Settings:
    whisper_model: str = "base.en"
    cpu_threads: int = max(1, (os.cpu_count() or 2) - 1)
    max_upload_mb: int = 500
    diarization_model: str = "pyannote/speaker-diarization-3.1"


def _config_values() -> dict:
    config_path = Path(os.getenv("LOCAL_TRANSCRIBER_CONFIG", PROJECT_DIR / "config.toml"))
    if not config_path.is_file():
        return {}
    with config_path.open("rb") as config_file:
        return tomllib.load(config_file)


def load_settings() -> Settings:
    values = _config_values()
    return Settings(
        whisper_model=str(values.get("whisper_model", Settings.whisper_model)),
        cpu_threads=max(1, int(values.get("cpu_threads", Settings.cpu_threads))),
        max_upload_mb=max(1, int(values.get("max_upload_mb", Settings.max_upload_mb))),
        diarization_model=str(values.get("diarization_model", Settings.diarization_model)),
    )


settings = load_settings()
