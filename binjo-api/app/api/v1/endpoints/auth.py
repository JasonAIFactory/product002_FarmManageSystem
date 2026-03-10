"""
Auth endpoints — Kakao OAuth login + profile.

Flow:
1. GET /auth/kakao/login → returns Kakao login URL
2. POST /auth/kakao → frontend sends authorization code → returns JWT
3. GET /auth/me → returns current farmer profile (requires JWT)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.jwt_handler import create_access_token
from app.core.auth.kakao_auth import exchange_code_for_token, get_kakao_login_url, get_kakao_user_profile
from app.database import get_db
from app.dependencies import get_current_farmer
from app.models.farmer import Farmer
from app.schemas.auth import FarmerProfile, KakaoCallbackRequest, TokenResponse

router = APIRouter()


@router.get("/kakao/login")
async def kakao_login_url() -> dict[str, str]:
    """Return the Kakao OAuth login URL for the frontend to redirect to."""
    return {"login_url": get_kakao_login_url()}


@router.post("/kakao", response_model=TokenResponse)
async def kakao_callback(
    body: KakaoCallbackRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    Exchange Kakao authorization code for our JWT.
    Creates the farmer account on first login (upsert pattern).
    """
    try:
        # Step 1: Exchange code for Kakao access token
        token_data = await exchange_code_for_token(body.code)
        kakao_access_token = token_data["access_token"]

        # Step 2: Fetch user profile from Kakao
        profile = await get_kakao_user_profile(kakao_access_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "KAKAO_AUTH_FAILED", "message": "카카오 인증에 실패했습니다"},
        )

    # Step 3: Upsert farmer — create on first login, update on subsequent logins
    result = await db.execute(
        select(Farmer).where(Farmer.kakao_id == profile["kakao_id"])
    )
    farmer = result.scalar_one_or_none()

    if farmer is None:
        # First login — create new farmer
        farmer = Farmer(
            kakao_id=profile["kakao_id"],
            nickname=profile["nickname"],
            profile_image_url=profile["profile_image_url"],
        )
        db.add(farmer)
        await db.commit()
        await db.refresh(farmer)
    else:
        # Returning user — update profile in case it changed on Kakao
        farmer.nickname = profile["nickname"]
        farmer.profile_image_url = profile["profile_image_url"]
        await db.commit()

    # Step 4: Issue our own JWT with farmer's ID as subject
    access_token = create_access_token(subject=str(farmer.id), role=farmer.role)
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=FarmerProfile)
async def get_me(farmer: Farmer = Depends(get_current_farmer)) -> FarmerProfile:
    """Return the current farmer's profile."""
    return FarmerProfile(
        id=str(farmer.id),
        kakao_id=farmer.kakao_id,
        nickname=farmer.nickname,
        profile_image_url=farmer.profile_image_url,
        role=farmer.role,
    )
