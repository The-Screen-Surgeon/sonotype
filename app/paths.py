"""Persistent per-user paths for Sonotype desktop data."""

from __future__ import annotations

import os
import sys
from pathlib import Path


APP_NAME = "Sonotype"


def app_data_dir() -> Path:
    """Return Sonotype's writable per-user data directory.

    The executable may be installed under a protected directory and a
    PyInstaller one-file app extracts its code into a temporary directory.
    User data must therefore live outside the application bundle.
    ``SONOTYPE_DATA_DIR`` is supported for tests and advanced local setups.
    """
    override = os.getenv("SONOTYPE_DATA_DIR")
    if override:
        return Path(override).expanduser()

    if sys.platform == "win32":
        base = os.getenv("LOCALAPPDATA") or os.getenv("APPDATA")
        return (Path(base) if base else Path.home() / "AppData" / "Local") / APP_NAME
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / APP_NAME

    base = os.getenv("XDG_DATA_HOME")
    return (Path(base) if base else Path.home() / ".local" / "share") / APP_NAME


def ensure_app_data_dir() -> Path:
    path = app_data_dir()
    path.mkdir(parents=True, exist_ok=True)
    return path


def webview_storage_dir() -> Path:
    path = ensure_app_data_dir() / "webview"
    path.mkdir(parents=True, exist_ok=True)
    return path


def runtime_uploads_dir() -> Path:
    path = ensure_app_data_dir() / "runtime" / "uploads"
    path.mkdir(parents=True, exist_ok=True)
    return path
