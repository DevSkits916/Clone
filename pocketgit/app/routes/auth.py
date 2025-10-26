from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from ..models.response_schemas import OkResponse
from ..services.auth_service import auth_service


router = APIRouter(prefix="/auth", tags=["auth"])


class AuthRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str


@router.post("/register", response_model=OkResponse, status_code=status.HTTP_201_CREATED)
def register(payload: AuthRequest) -> OkResponse:
    try:
        auth_service.create_user(payload.username, payload.password)
    except ValueError as exc:
        message = str(exc)
        if "already exists" in message:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=message) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message) from exc
    return OkResponse(ok=True)


@router.post("/login", response_model=LoginResponse)
def login(payload: AuthRequest) -> LoginResponse:
    if not auth_service.authenticate_user(payload.username, payload.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = auth_service.create_access_token(payload.username)
    return LoginResponse(token=token)
