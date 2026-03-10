"""
Voice processing pipeline — the full flow from audio to structured farm log.

Pipeline stages:
1. Upload audio to Supabase Storage
2. Transcribe with Whisper (STT)
3. Post-process transcript (fix common mishearings)
4. Parse with Claude (extract structured data)
5. Return structured result for farmer review

Each stage updates the VoiceRecording status so the UI can show progress.
"""

import json
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai.claude_provider import ClaudeProvider
from app.core.stt.post_processor import correct_transcript
from app.core.stt.whisper_api import transcribe_audio
from app.models.voice_recording import VoiceRecording
from app.modules.farm_log.parser_prompt import SYSTEM_PROMPT, build_user_message


async def process_voice_recording(
    db: AsyncSession,
    recording: VoiceRecording,
    audio_bytes: bytes,
    filename: str,
    content_type: str,
) -> dict:
    """
    Run the full voice → structured data pipeline.

    Updates recording.status as it progresses:
    - "processing" → while STT + parsing are running
    - "completed" → on success, with transcript and parsed_data saved
    - "failed" → on error, with error_message saved

    Returns the parsed farm log data dict on success, raises on failure.
    """
    try:
        # Stage 1: Mark as processing
        recording.status = "processing"
        await db.commit()

        # Stage 2: Transcribe with Whisper
        whisper_result = await transcribe_audio(audio_bytes, filename, content_type)
        raw_transcript = whisper_result["text"]

        if not raw_transcript.strip():
            raise ValueError("음성이 인식되지 않았습니다. 다시 녹음해주세요.")

        # Stage 3: Post-process — fix common agricultural term mishearings
        corrected_transcript = correct_transcript(raw_transcript)
        recording.transcript = corrected_transcript

        # Stage 4: Parse with Claude — extract structured farm log data
        today_str = datetime.now(UTC).strftime("%Y-%m-%d")
        user_message = build_user_message(corrected_transcript, today_str)

        claude = ClaudeProvider()
        raw_response = await claude.complete(
            system_prompt=SYSTEM_PROMPT,
            user_message=user_message,
            temperature=0.0,
        )

        # Claude should return pure JSON — parse it
        parsed_data = json.loads(raw_response)

        # Stage 5: Save results
        recording.parsed_data = parsed_data
        recording.status = "completed"
        recording.processed_at = datetime.now(UTC)
        # Auto-delete audio after 30 days — privacy protection
        recording.expires_at = datetime.now(UTC) + timedelta(days=30)
        await db.commit()

        return parsed_data

    except json.JSONDecodeError:
        # Claude returned non-JSON — save the raw response for debugging
        recording.status = "failed"
        recording.error_message = f"AI 응답 파싱 실패: {raw_response[:500]}"
        await db.commit()
        raise ValueError("AI 응답을 파싱할 수 없습니다. 다시 시도해주세요.")

    except Exception as e:
        recording.status = "failed"
        recording.error_message = str(e)[:500]
        await db.commit()
        raise
