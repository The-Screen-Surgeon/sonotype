"""Launch Sonotype in a native desktop window."""

from __future__ import annotations

import os
import sys
import socket
import threading
import time
from pathlib import Path

import uvicorn
import webview

from app.main import app


def _setup_ffmpeg() -> None:
    """Make bundled FFmpeg discoverable on PATH.

    When packaged with PyInstaller (frozen), FFmpeg lives inside the
    executable's temp extraction directory under ffmpeg/.  When running
    from source, check ffmpeg/ next to the project root as a fallback.
    """
    candidates: list[Path] = []
    if getattr(sys, "frozen", False):
        # PyInstaller one-file mode extracts to sys._MEIPASS
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            candidates.append(Path(meipass) / "ffmpeg")
        candidates.append(Path(sys.executable).parent / "ffmpeg")
    else:
        candidates.append(Path(__file__).resolve().parent / "ffmpeg")

    for candidate in candidates:
        if candidate.is_dir():
            ffmpeg_exe = candidate / ("ffmpeg.exe" if os.name == "nt" else "ffmpeg")
            if ffmpeg_exe.exists():
                os.environ["PATH"] = f"{candidate}{os.pathsep}{os.environ.get('PATH', '')}"
                os.environ["FFMPEG_BINARY"] = str(ffmpeg_exe)
                return


def available_port() -> int:
    """Ask the OS for an available loopback port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def main() -> None:
    _setup_ffmpeg()

    port = available_port()
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning"))
    server_thread = threading.Thread(target=server.run, name="sonotype-server", daemon=True)
    server_thread.start()

    deadline = time.monotonic() + 10
    while not server.started and time.monotonic() < deadline:
        time.sleep(0.05)
    if not server.started:
        server.should_exit = True
        raise RuntimeError("Sonotype's local server did not start.")

    webview.create_window("Sonotype", f"http://127.0.0.1:{port}", min_size=(900, 700))
    try:
        webview.start()
    finally:
        server.should_exit = True
        server_thread.join(timeout=5)


if __name__ == "__main__":
    main()