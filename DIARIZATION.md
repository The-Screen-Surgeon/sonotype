# Local speaker diarization

PrivateScribe supports only anonymous labels: Speaker 1, Speaker 2, and so on. It does not perform speaker identification, voice enrollment, biometric matching, or name assignment.

## Recommended option

- Dependency: `pyannote.audio>=3.3,<4`
- Runtime setting: `PRIVATE_SCRIBE_DIARIZATION_MODEL=/absolute/path/to/local/pipeline`
- Operation: the application loads that local pipeline from disk and overlaps its anonymous turns with faster-whisper segments. It remaps output labels by first appearance to Speaker 1, Speaker 2, etc.

This is fully local at runtime only after an approved compatible model bundle and its weights are already present on disk. PrivateScribe deliberately does not use a hosted model ID or an access token.

## Alternative: NVIDIA NeMo

- Dependency: `nemo_toolkit[asr]` plus a compatible local diarization checkpoint/configuration.
- Tradeoff: heavier environment and more GPU-oriented tooling; CPU inference is possible but substantially slower. It is better for longer multi-speaker recordings when a locally staged NeMo bundle is already approved.

## Current blockers

1. Pyannote pipeline bundles often require a one-time model-license acceptance and download from Hugging Face before they can be staged locally. That cannot be completed by this application without an approved model source and license decision.
2. Diarization on CPU can be slow and memory-intensive, especially for long recordings.
3. Speaker count and turn boundaries are estimates; generic labels do not establish a person's identity.
4. FFmpeg must be installed locally for reliable decoding of the full advertised audio/video import list.
