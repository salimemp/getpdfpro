"""Current user endpoints."""

from fastapi import APIRouter, Depends

from app.core.security import AuthUser, get_current_user

router = APIRouter()


@router.get("", response_model=dict)
async def get_me(user: AuthUser = Depends(get_current_user)) -> dict:
    """Get current user profile."""
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.user_metadata.get("display_name"),
        "avatar_url": user.user_metadata.get("avatar_url"),
        "role": user.role,
    }
