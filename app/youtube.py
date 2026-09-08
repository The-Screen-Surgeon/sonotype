"""Local YouTube audio download support."""

from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse


YOUTUBE_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"}


def is_youtube_url(value: str) -> bool:
    """Return whether value is an http(s) URL for a supported YouTube host."""
    try:
        parsed = urlparse(value.strip())
    except ValueError:
        return False
    return parsed.scheme in {"http", "https"} and parsed.hostname in YOUTUBE_HOSTS


def download_audio(url: str, destination_dir: Path, progress_hook=None) -> Path:
    """Download best available audio into destination_dir and return its local path."""
    if not is_youtube_url(url):
        raise ValueError("Enter a valid YouTube URL.")

    try:
        import yt_dlp
    except ImportError as exc:
        raise RuntimeError("yt-dlp is not installed. Install requirements.txt first.") from exc

    def hook(status: dict) -> None:
        if progress_hook:
            progress_hook(status)

    options = {
        "format": "bestaudio/best",
        "outtmpl": str(destination_dir / "youtube-%(id)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "progress_hooks": [hook],
    }
    with yt_dlp.YoutubeDL(options) as downloader:
        metadata = downloader.extract_info(url, download=True)
        filename = downloader.prepare_filename(metadata)

    path = Path(filename)
    if path.exists():
        return path
    candidates = sorted(destination_dir.glob(f"youtube-{metadata.get('id', '')}.*"))
    if not candidates:
        raise RuntimeError("Audio download completed but no local file was found.")
    return candidates[0]
