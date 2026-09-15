# Sonotype

> Turn speech into text. Keep it yours.

Sonotype is local AI transcription for Windows, Linux, and macOS. It is a focused desktop utility for recording, transcribing, editing, and saving audio on your computer.

[Download Sonotype](https://the-screen-surgeon.github.io/sonotype/) · [View releases](https://github.com/The-Screen-Surgeon/sonotype/releases) · [Source code](https://github.com/The-Screen-Surgeon/sonotype)

![Sonotype screenshot placeholder](docs/screenshot-placeholder.svg)

## Why Sonotype

Sonotype is a transcription tool, not another platform.

- **Private by default:** recordings, imported files, and transcripts are processed locally.
- **No account or subscription:** open the app when you need it and keep using it for free.
- **No telemetry or cloud transcription API:** your words stay on your machine.
- **Simple workflow:** record locally, import media, or prepare a permitted YouTube URL, then review and save.

## What it does

- Record from your microphone, pause and resume, then use **Stop & Transcribe**.
- Import MP3, WAV, M4A, MP4, MOV, WebM, and other common audio/video formats up to 750 MB.
- Prepare a permitted YouTube URL and download its audio locally for transcription.
- Transcribe on your CPU with faster-whisper and the `small.en` model.
- Review editable timestamped text with a confidence score.
- Use anonymous speaker labels (`Speaker 1`, `Speaker 2`, …) when a local diarization model is configured.
- Copy text or save TXT, Markdown, CSV, HTML, DOCX, or PDF files locally.
- Reopen saved transcript copies from the browser-local Library.
- Run in a native desktop window rather than a browser tab.

## How it works

1. **Choose a source.** Record from your microphone, import a media file, or use a permitted YouTube URL.
2. **Transcribe locally.** Sonotype runs the speech model on your computer. It does not upload your recording to a transcription service.
3. **Edit and save.** Review the transcript, make changes, and save the format you need.

The app makes network requests only when it needs to download the speech model for the first transcription or when you explicitly use the YouTube source. Imported files and downloaded audio are held in a temporary local folder while a job runs, then deleted automatically when it finishes.

## Download for Windows, Linux, and macOS

The [Sonotype download page](https://the-screen-surgeon.github.io/sonotype/) has the same platform guidance and the latest download buttons. Direct release links are below:

| Platform | Download | Notes |
|---|---|---|
| Windows x64 | [Sonotype-Windows-x64.zip](https://github.com/The-Screen-Surgeon/sonotype/releases/latest/download/Sonotype-Windows-x64.zip) | Windows 10/11; unzip and run `Sonotype.exe` |
| Linux x64 | [Sonotype-Linux-x64.tar.gz](https://github.com/The-Screen-Surgeon/sonotype/releases/latest/download/Sonotype-Linux-x64.tar.gz) | 64-bit Linux desktop; GTK 3 and WebKitGTK may be required |
| macOS Apple silicon | [Sonotype-macOS-arm64.zip](https://github.com/The-Screen-Surgeon/sonotype/releases/latest/download/Sonotype-macOS-arm64.zip) | M-series Macs; macOS 12+ |
| macOS Intel | [Sonotype-macOS-x64.zip](https://github.com/The-Screen-Surgeon/sonotype/releases/latest/download/Sonotype-macOS-x64.zip) | Older Intel Macs; macOS 12+ |

The release packages include FFmpeg and do not require a Python installation. Linux users may need their distribution’s GTK 3 and WebKitGTK desktop libraries. On Debian/Ubuntu, the usual packages are:

```bash
sudo apt install libgtk-3-0 libwebkit2gtk-4.1-0
```

### Windows SmartScreen warning

Sonotype is not signed with a Microsoft code-signing certificate. Windows may show a **Windows protected your PC** screen the first time you run it:

1. Click **More info**.
2. Click **Run anyway**.
3. Sonotype will launch.

This is a one-time warning for this unsigned open-source application.

### macOS security warning

Sonotype is not signed with an Apple Developer certificate. If macOS blocks the first launch, open **System Settings → Privacy & Security**, then choose **Open Anyway** for Sonotype. This is a one-time Gatekeeper prompt.

## First-run setup

The first transcription downloads the `small.en` Whisper model (about 500 MB) and caches it locally. This is a one-time download; after it completes, subsequent transcriptions start from the local cache.

The easiest setup is a short 5–10 second recording. It lets the model download while you try the workflow.

Typical CPU timing with `small.en`:

| Audio length | Approx. time |
|---|---|
| 1 minute | 20–30 seconds |
| 10 minutes | 4–6 minutes |
| 1 hour | 25–35 minutes |

The app runs at roughly 0.4x real-time on a typical laptop CPU. For an air-gapped setup, pre-stage the model cache before running Sonotype.

## Install and run from source

Sonotype supports Python 3.10–3.12.

```bash
git clone https://github.com/The-Screen-Surgeon/sonotype.git
cd sonotype
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python desktop.py
```

You can also use `./launch.sh` on macOS/Linux (make it executable with `chmod +x launch.sh`) or `launch.bat` on Windows.

For browser-based development:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8765
```

Then open <http://127.0.0.1:8765>. The development server is still local-only.

Set `SONOTYPE_WHISPER_MODEL` to choose another installed faster-whisper model. The default is `small.en`, the balance of accuracy and CPU speed used by the release builds.

## YouTube usage

YouTube import downloads audio to the local runtime directory through `yt-dlp`, transcribes it locally, and deletes the temporary file when the job ends. Use this only for videos you own or are permitted to download, and follow YouTube’s terms and applicable law.

## Speaker labels

Speaker labeling is anonymous and local. When a diarization model is configured, Sonotype assigns generic labels such as `Speaker 1` and `Speaker 2`; it does not identify people by name. Without the optional model, Sonotype still transcribes normally and skips speaker labels.

To enable the optional diarization engine locally:

```bash
pip install -r requirements-diarization.txt
export SONOTYPE_DIARIZATION_MODEL=/absolute/path/to/local/pipeline
```

See [DIARIZATION.md](DIARIZATION.md) for setup notes.

## Tech stack

- FastAPI + Uvicorn
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
- [pywebview](https://pywebview.flowrl.com/)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- python-docx and ReportLab
- PyInstaller desktop packaging

## License

MIT. See [LICENSE](LICENSE).

Built by Brandon Hatcher.
