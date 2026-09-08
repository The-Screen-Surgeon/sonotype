# PrivateScribe — private staging

PrivateScribe is a portfolio-sized, local-first dictation and transcription application. It has no cloud API, account system, telemetry, document-management integration, client or matter lookup, legal metadata, ticketing, or named-speaker recognition.

## Run locally

1. Create a virtual environment with Python 3.10–3.12.
2. Install the base build: `pip install -r requirements.txt`
3. Start it: `uvicorn app.main:app --host 127.0.0.1 --port 8765`
4. Open http://127.0.0.1:8765

The first transcription downloads the selected faster-whisper model into the local model cache. For an air-gapped deployment, pre-stage that model cache before running PrivateScribe.

## Optional local speaker diarization

Install the optional package: `pip install -r requirements-diarization.txt`. Then set `PRIVATE_SCRIBE_DIARIZATION_MODEL` to a **local filesystem directory** containing an approved, compatible pyannote diarization pipeline and all of its model weights. PrivateScribe never supplies a hosted model identifier, token, or voice-enrollment workflow.

See [DIARIZATION.md](DIARIZATION.md) for the specific options and constraints.

## Privacy boundary

Audio is received by the local server only, processed locally, and written to `runtime/uploads` only for the duration of a job. It is deleted in a `finally` block after processing. The runtime directory is ignored by Git. No Git repository has been initialized for this staging build.
