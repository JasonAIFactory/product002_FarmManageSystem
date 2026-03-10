"""
Shared FastAPI dependencies — injected into endpoints via Depends().

This is the Dependency Injection pattern — FastAPI resolves these per request,
keeping endpoint code clean and testable.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.jwt_handler import verify_token
from app.database import get_db
from app.models.farmer import Farmer

# HTTPBearer extracts the token from "Authorization: Bearer <token>" header
security = HTTPBearer()


async def get_current_farmer(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Farmer:
    """
    Verify JWT and return the current Farmer.
    Raises 401 if token is invalid or farmer not found.
    """
    payload = verify_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "인증이 만료되었습니다"},
        )

    farmer_id = payload.get("sub")
    if not farmer_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "message": "잘못된 토큰입니다"},
        )

    result = await db.execute(select(Farmer).where(Farmer.id == farmer_id))
    farmer = result.scalar_one_or_none()

    if farmer is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "USER_NOT_FOUND", "message": "사용자를 찾을 수 없습니다"},
        )

    return farmer
