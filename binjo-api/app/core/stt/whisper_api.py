"""
OpenAI Whisper API client — speech-to-text for Korean agricultural voice recordings.

# CORE_CANDIDATE — reusable for any voice-input product.

Key design decisions:
- Prompt priming with agricultural terms improves Korean accuracy significantly
- verbose_json response gives us timestamps for future features (highlight segments)
- Language forced to "ko" to prevent Whisper from guessing wrong on short recordings
"""

from openai import AsyncOpenAI

from app.config import settings

# Agricultural terms that Whisper commonly mishears — prompt priming fixes this
# These terms appear in the system prompt so Whisper knows the domain context
AGRICULTURAL_PROMPT = (
    "사과 과수원 영농일지. "
    "전정, 적과, 적화, 봉지씌우기, 수확, 시비, 방제, 살포. "
    "석회유황합제, 기계유유제, 만코지, 디페노코나졸. "
    "3번 밭, 앞 과수원, 뒷 과수원. "
    "공익직불금, 영농일지."
)


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "recording.webm",
    content_type: str = "audio/webm",
) -> dict:
    """
    Transcribe audio using OpenAI Whisper API.

    Args:
        audio_bytes: Raw audio file bytes
        filename: Original filename (Whisper uses extension to detect format)
        content_type: MIME type of the audio

    Returns:
        dict with keys: text (full transcript), segments (timestamped chunks)
    """
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    # Whisper accepts file-like tuples: (filename, bytes, content_type)
    response = await client.audio.transcriptions.create(
        model="whisper-1",
        file=(filename, audio_bytes, content_type),
        language="ko",
        response_format="verbose_json",
        # Prompt priming — tells Whisper the domain context so it recognizes
        # agricultural terms instead of guessing common homophones
        prompt=AGRICULTURAL_PROMPT,
    )

    return {
        "text": response.text,
        "segments": [
            {
                "start": seg.start,
                "end": seg.end,
                "text": seg.text,
            }
            for seg in (response.segments or [])
        ],
    }
