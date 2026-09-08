def clean_transcript(raw_text: str) -> str:
    """Keep the local transcript faithful; users edit it in the browser."""
    return raw_text.strip()
