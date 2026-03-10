"""
Supabase Storage file manager — upload/delete audio and image files.

# CORE_CANDIDATE — reusable S3-compatible storage operations.

Uses the same Supabase Storage as Phase 1 but in a separate bucket for audio.
"""

import uuid

from supabase import create_client

from app.config import settings

AUDIO_BUCKET = "audio"


def _get_client():
    """Lazy init — avoids crash if env vars are missing during import."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


async def upload_audio(audio_bytes: bytes, content_type: str) -> str:
    """
    Upload audio file to Supabase Storage.
    Returns the public URL of the uploaded file.
    """
    supabase = _get_client()
    # Unique path to prevent collisions
    path = f"{uuid.uuid4()}.webm"

    supabase.storage.from_(AUDIO_BUCKET).upload(
        path,
        audio_bytes,
        file_options={"content-type": content_type, "upsert": "false"},
    )

    data = supabase.storage.from_(AUDIO_BUCKET).get_public_url(path)
    return data


async def delete_audio(url: str) -> None:
    """Delete an audio file from Supabase Storage by its URL."""
    supabase = _get_client()
    # Extract path from URL: .../audio/uuid.webm → uuid.webm
    path = url.split(f"/{AUDIO_BUCKET}/")[-1]
    supabase.storage.from_(AUDIO_BUCKET).remove([path])
