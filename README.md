# private-scribe

## Purpose

`private-scribe` is a local-first dictation and transcription prototype. Record in a browser or import an audio/video file, transcribe on local CPU with faster-whisper, edit the transcript, and export a generic DOCX or PDF.

## Status

Public prototype. The repository name is temporary; the interface deliberately uses generic, brand-neutral language.

## Ownership and Support

Maintained by Brandon Hatcher. This project is provided as a portfolio demonstration; it has no hosted service or support commitment.

## Technology

- Python 3.11+ with FastAPI and Uvicorn
- CPU-only faster-whisper (`int8`) transcription
- Vanilla HTML, CSS, and JavaScript browser interface
- `python-docx` and ReportLab for local document export
- Optional `pyannote.audio` add-on for local speaker diarization

## Local Development

1. Create and activate a virtual environment.

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. Install the standard local dependencies.

   ```bash
   pip install -r requirements.txt
   ```

3. Optionally customize safe local settings.

   ```bash
   cp config.example.toml config.toml
   ```

4. Run the local service and open <http://127.0.0.1:8000>.

   ```bash
   cd backend
   uvicorn main:app --host 127.0.0.1 --port 8000
   ```

## Configuration

`config.example.toml` contains non-sensitive CPU, model, and upload-limit defaults. `config.toml` is ignored by Git. No credentials are needed for recording, import, transcription, editing, or export.

To enable optional local diarization, install `requirements-diarization.txt`, accept the model's upstream access conditions, and set `LOCAL_TRANSCRIBER_HF_TOKEN` in your shell. Audio is still processed on the local machine. Labels remain generic—`Speaker 1`, `Speaker 2`, and so on; the application does not identify people by name.

## Testing

```bash
python -m pytest -q
```

The test suite checks the health endpoint, local frontend serving, and generic DOCX/PDF exports. It does not download or run a Whisper model.

## Deployment

None. This prototype is designed to run on `127.0.0.1` on the user's own computer.

## Repository Map

```text
backend/                 Local API, CPU transcription, export, optional diarization
frontend/                Browser recording, import, transcript editing, and exports
config.example.toml      Safe sample configuration
requirements*.txt        Standard and optional local dependencies
tests/                   Endpoint and export checks
ROADMAP.md               Current scope and known risks
```

## Roadmap

See [ROADMAP.md](ROADMAP.md) for current work, limits, and planned improvements.

## Privacy

This application sends no recording or transcript to an application-hosted service. The browser posts files only to the local service running on your machine, and faster-whisper runs on CPU locally. The selected model may download from its upstream model host on first use. Optional diarization also downloads its model after the user supplies the required upstream access token; it runs locally and returns generic speaker labels only.
