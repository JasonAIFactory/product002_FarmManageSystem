"""
Voice recording endpoints — upload, check status, get parsed results.

Flow:
1. POST /voice/upload — farmer uploads audio file
2. Pipeline runs: Whisper STT → post-process → Claude parse
3. GET /voice/{id}/status — check processing status
4. GET /voice/{id}/result — get the structured farm log data
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage.file_manager import upload_audio
from app.database import get_db
from app.dependencies import get_current_farmer
from app.models.farmer import Farmer
from app.models.voice_recording import VoiceRecording
from app.modules.farm_log.voice_pipeline import process_voice_recording
from app.schemas.voice import VoiceResultResponse, VoiceStatusResponse, VoiceUploadResponse

router = APIRouter()

# 5 minutes max recording, ~10MB
MAX_AUDIO_SIZE = 25 * 1024 * 1024  # 25MB (Whisper API limit)
ALLOWED_AUDIO_TYPES = {
    "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4",
    "audio/wav", "audio/x-wav", "audio/mp3",
}


@router.post("/upload", response_model=VoiceUploadResponse)
async def upload_voice(
    file: UploadFile,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> VoiceUploadResponse:
    """
    Upload a voice recording and process it through the STT + AI pipeline.
    Currently synchronous — farmer waits for the result.
    Will be async (Celery) in a future sprint when we need it.
    """
    # Validate file type
    content_type = file.content_type or "audio/webm"
    if content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INVALID_TYPE", "message": "지원하지 않는 오디오 형식입니다"},
        )

    # Read file bytes
    audio_bytes = await file.read()

    if len(audio_bytes) > MAX_AUDIO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "TOO_LARGE", "message": "25MB 이하의 파일만 업로드 가능합니다"},
        )

    if len(audio_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "EMPTY_FILE", "message": "빈 파일입니다"},
        )

    # Upload to Supabase Storage
    audio_url = await upload_audio(audio_bytes, content_type)

    # Create recording record
    recording = VoiceRecording(
        farmer_id=farmer.id,
        audio_url=audio_url,
        file_size_bytes=len(audio_bytes),
        status="uploaded",
    )
    db.add(recording)
    await db.commit()
    await db.refresh(recording)

    # Process synchronously for now — Celery later
    try:
        await process_voice_recording(
            db=db,
            recording=recording,
            audio_bytes=audio_bytes,
            filename=file.filename or "recording.webm",
            content_type=content_type,
        )
        return VoiceUploadResponse(
            id=str(recording.id),
            status="completed",
            message="음성 기록이 처리되었습니다",
        )
    except Exception as e:
        return VoiceUploadResponse(
            id=str(recording.id),
            status="failed",
            message=str(e),
        )


@router.get("/{recording_id}/status", response_model=VoiceStatusResponse)
async def get_voice_status(
    recording_id: str,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> VoiceStatusResponse:
    """Check the processing status of a voice recording."""
    result = await db.execute(
        select(VoiceRecording).where(
            VoiceRecording.id == recording_id,
            VoiceRecording.farmer_id == farmer.id,
        )
    )
    recording = result.scalar_one_or_none()

    if recording is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "녹음을 찾을 수 없습니다"},
        )

    return VoiceStatusResponse(
        id=str(recording.id),
        status=recording.status,
        transcript=recording.transcript,
        error_message=recording.error_message,
    )


@router.get("/{recording_id}/result", response_model=VoiceResultResponse)
async def get_voice_result(
    recording_id: str,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> VoiceResultResponse:
    """Get the parsed result of a completed voice recording."""
    result = await db.execute(
        select(VoiceRecording).where(
            VoiceRecording.id == recording_id,
            VoiceRecording.farmer_id == farmer.id,
        )
    )
    recording = result.scalar_one_or_none()

    if recording is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "녹음을 찾을 수 없습니다"},
        )

    if recording.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "NOT_READY",
                "message": f"처리 상태: {recording.status}",
            },
        )

    return VoiceResultResponse(
        id=str(recording.id),
        status=recording.status,
        transcript=recording.transcript,
        parsed_data=recording.parsed_data,
        created_at=recording.created_at,
    )
