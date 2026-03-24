"""
Farm log CRUD endpoints — create, read, update, delete, confirm.

Farm logs can be created from voice pipeline results or manually.
The flow: voice recording → parsed data → farmer reviews → creates farm log → confirms.
Weather is auto-filled from 기상청 API on creation if not already present.
"""

import logging
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.external_api.weather_kma import format_weather_summary, get_weather_for_date
from app.database import get_db
from app.dependencies import get_current_farmer
from app.models.farm_log import ChemicalUsage, FarmLog, FarmLogTask
from app.models.farmer import Farmer
from app.schemas.farm_log import (
    ChemicalResponse,
    FarmLogCreate,
    FarmLogListResponse,
    FarmLogResponse,
    FarmLogUpdate,
    TaskResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _log_to_response(log: FarmLog) -> FarmLogResponse:
    """Convert a FarmLog ORM object to a Pydantic response."""
    return FarmLogResponse(
        id=str(log.id),
        log_date=log.log_date,
        status=log.status,
        crop=log.crop,
        tasks=[
            TaskResponse(
                id=str(t.id),
                field_name=t.field_name,
                stage=t.stage,
                detail=t.detail,
                duration_hours=float(t.duration_hours) if t.duration_hours else None,
            )
            for t in sorted(log.tasks, key=lambda t: t.sort_order)
        ],
        chemicals=[
            ChemicalResponse(
                id=str(c.id),
                type=c.type,
                name=c.name,
                amount=c.amount,
                action=c.action,
            )
            for c in log.chemicals
        ],
        weather_official=log.weather_official,
        weather_farmer=log.weather_farmer,
        notes=log.notes,
        voice_recording_id=str(log.voice_recording_id) if log.voice_recording_id else None,
        created_at=log.created_at,
        updated_at=log.updated_at,
    )


@router.get("", response_model=FarmLogListResponse)
async def list_farm_logs(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> FarmLogListResponse:
    """List farm logs with optional date range filter."""
    query = (
        select(FarmLog)
        .where(FarmLog.farmer_id == farmer.id)
        .options(selectinload(FarmLog.tasks), selectinload(FarmLog.chemicals))
        .order_by(FarmLog.log_date.desc())
    )

    if date_from:
        query = query.where(FarmLog.log_date >= date_from)
    if date_to:
        query = query.where(FarmLog.log_date <= date_to)

    result = await db.execute(query)
    logs = result.scalars().all()

    # Count total
    count_query = select(func.count(FarmLog.id)).where(FarmLog.farmer_id == farmer.id)
    if date_from:
        count_query = count_query.where(FarmLog.log_date >= date_from)
    if date_to:
        count_query = count_query.where(FarmLog.log_date <= date_to)
    total = (await db.execute(count_query)).scalar() or 0

    return FarmLogListResponse(
        logs=[_log_to_response(log) for log in logs],
        total=total,
    )


@router.post("", response_model=FarmLogResponse, status_code=status.HTTP_201_CREATED)
async def create_farm_log(
    body: FarmLogCreate,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> FarmLogResponse:
    """Create a new farm log — from voice pipeline result or manual entry."""
    # Auto-fill official weather if not already provided
    # Best-effort: if KMA API fails, we still create the log without it
    weather_official = None
    try:
        weather_data = await get_weather_for_date(body.log_date.isoformat())
        if weather_data:
            weather_data["summary"] = format_weather_summary(weather_data)
            weather_official = weather_data
    except Exception as e:
        logger.warning("Weather auto-fill failed for %s: %s", body.log_date, e)

    log = FarmLog(
        farm_id=farmer.farm_id or farmer.id,  # fallback if farm_id not set
        farmer_id=farmer.id,
        voice_recording_id=UUID(body.voice_recording_id) if body.voice_recording_id else None,
        log_date=body.log_date,
        crop=body.crop,
        weather_official=weather_official,
        weather_farmer=body.weather_farmer,
        notes=body.notes,
        status="draft",
    )
    db.add(log)
    await db.flush()  # Get log.id before creating children

    # Create task entries
    for i, task in enumerate(body.tasks):
        db.add(FarmLogTask(
            farm_log_id=log.id,
            field_name=task.field_name,
            stage=task.stage,
            detail=task.detail,
            duration_hours=task.duration_hours,
            sort_order=i,
        ))

    # Create chemical entries
    for chem in body.chemicals:
        db.add(ChemicalUsage(
            farm_log_id=log.id,
            type=chem.type,
            name=chem.name,
            amount=chem.amount,
            action=chem.action,
        ))

    await db.commit()

    # Re-fetch with relationships loaded
    result = await db.execute(
        select(FarmLog)
        .where(FarmLog.id == log.id)
        .options(selectinload(FarmLog.tasks), selectinload(FarmLog.chemicals))
    )
    log = result.scalar_one()
    return _log_to_response(log)


@router.get("/{log_id}", response_model=FarmLogResponse)
async def get_farm_log(
    log_id: str,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> FarmLogResponse:
    """Get a single farm log by ID."""
    result = await db.execute(
        select(FarmLog)
        .where(FarmLog.id == log_id, FarmLog.farmer_id == farmer.id)
        .options(selectinload(FarmLog.tasks), selectinload(FarmLog.chemicals))
    )
    log = result.scalar_one_or_none()

    if log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "기록을 찾을 수 없습니다"},
        )

    return _log_to_response(log)


@router.put("/{log_id}", response_model=FarmLogResponse)
async def update_farm_log(
    log_id: str,
    body: FarmLogUpdate,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> FarmLogResponse:
    """Update a farm log — farmer edits before confirming."""
    result = await db.execute(
        select(FarmLog)
        .where(FarmLog.id == log_id, FarmLog.farmer_id == farmer.id)
        .options(selectinload(FarmLog.tasks), selectinload(FarmLog.chemicals))
    )
    log = result.scalar_one_or_none()

    if log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "기록을 찾을 수 없습니다"},
        )

    # Update scalar fields
    if body.log_date is not None:
        log.log_date = body.log_date
    if body.crop is not None:
        log.crop = body.crop
    if body.weather_farmer is not None:
        log.weather_farmer = body.weather_farmer
    if body.notes is not None:
        log.notes = body.notes

    # Replace tasks if provided
    if body.tasks is not None:
        # Delete existing tasks
        for task in log.tasks:
            await db.delete(task)
        # Create new tasks
        for i, task in enumerate(body.tasks):
            db.add(FarmLogTask(
                farm_log_id=log.id,
                field_name=task.field_name,
                stage=task.stage,
                detail=task.detail,
                duration_hours=task.duration_hours,
                sort_order=i,
            ))

    # Replace chemicals if provided
    if body.chemicals is not None:
        for chem in log.chemicals:
            await db.delete(chem)
        for chem in body.chemicals:
            db.add(ChemicalUsage(
                farm_log_id=log.id,
                type=chem.type,
                name=chem.name,
                amount=chem.amount,
                action=chem.action,
            ))

    await db.commit()

    # Re-fetch
    result = await db.execute(
        select(FarmLog)
        .where(FarmLog.id == log.id)
        .options(selectinload(FarmLog.tasks), selectinload(FarmLog.chemicals))
    )
    log = result.scalar_one()
    return _log_to_response(log)


@router.put("/{log_id}/confirm", response_model=FarmLogResponse)
async def confirm_farm_log(
    log_id: str,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> FarmLogResponse:
    """Confirm a draft farm log — marks it as finalized."""
    result = await db.execute(
        select(FarmLog)
        .where(FarmLog.id == log_id, FarmLog.farmer_id == farmer.id)
        .options(selectinload(FarmLog.tasks), selectinload(FarmLog.chemicals))
    )
    log = result.scalar_one_or_none()

    if log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "기록을 찾을 수 없습니다"},
        )

    if log.status == "confirmed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "ALREADY_CONFIRMED", "message": "이미 확인된 기록입니다"},
        )

    log.status = "confirmed"
    await db.commit()

    return _log_to_response(log)


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_farm_log(
    log_id: str,
    farmer: Farmer = Depends(get_current_farmer),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a farm log. Tasks and chemicals cascade-delete."""
    result = await db.execute(
        select(FarmLog).where(FarmLog.id == log_id, FarmLog.farmer_id == farmer.id)
    )
    log = result.scalar_one_or_none()

    if log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "기록을 찾을 수 없습니다"},
        )

    await db.delete(log)
    await db.commit()
