# Roadmap — private-scribe

## Current State

Portfolio-ready local transcription application with browser recording, audio/video import, editable output, generic document exports, and an optional local speaker-labeling path.

## Now

- Keep the public repository focused on local-first transcription.

## Next

- Add timestamp navigation in the editable transcript.
- Add accessible keyboard shortcuts for recording and export.

## Later

- Evaluate offline model distribution options for easier first-run setup.

## Decisions Needed

- Whether to retain the working product name after portfolio review.

## Blockers and Risks

- The first transcription downloads the selected Whisper model.
- Optional diarization requires its separately installed model and access token.
- CPU transcription speed and quality vary by hardware and selected model.

## Change Log

- 2026-09-01 — Created sanitized public-release staging project.
