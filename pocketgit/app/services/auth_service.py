from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext


class AuthService:
    JWT_ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 12

    def __init__(self, users_path: Path):
        self.users_path = users_path
        self.users_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.users_path.exists():
            self.users_path.write_text("{}", encoding="utf-8")
        self._pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    @property
    def jwt_secret(self) -> str:
        return os.getenv("POCKETGIT_JWT_SECRET", "pocketgit-dev-secret")

    def _load_users(self) -> Dict[str, str]:
        try:
            raw = self.users_path.read_text(encoding="utf-8")
            if not raw.strip():
                return {}
            data = json.loads(raw)
            if isinstance(data, dict):
                return {str(k): str(v) for k, v in data.items()}
            return {}
        except (OSError, json.JSONDecodeError):
            return {}

    def _save_users(self, users: Dict[str, str]) -> None:
        payload = json.dumps(users, indent=2, sort_keys=True)
        self.users_path.write_text(payload, encoding="utf-8")

    def create_user(self, username: str, password: str) -> None:
        username = username.strip()
        if not username:
            raise ValueError("Username is required")
        if not password:
            raise ValueError("Password is required")
        users = self._load_users()
        if username in users:
            raise ValueError("User already exists")
        users[username] = self._pwd_context.hash(password)
        self._save_users(users)

    def authenticate_user(self, username: str, password: str) -> bool:
        users = self._load_users()
        stored = users.get(username)
        if not stored:
            return False
        return self._pwd_context.verify(password, stored)

    def user_exists(self, username: str) -> bool:
        users = self._load_users()
        return username in users

    def create_access_token(self, username: str, expires_delta: Optional[timedelta] = None) -> str:
        expire_delta = expires_delta or timedelta(minutes=self.ACCESS_TOKEN_EXPIRE_MINUTES)
        expire = datetime.now(timezone.utc) + expire_delta
        payload = {"sub": username, "exp": expire}
        return jwt.encode(payload, self.jwt_secret, algorithm=self.JWT_ALGORITHM)

    def verify_token(self, token: str) -> Optional[str]:
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=[self.JWT_ALGORITHM])
        except jwt.PyJWTError:
            return None
        username = payload.get("sub")
        if not username:
            return None
        if not self.user_exists(username):
            return None
        return str(username)


users_path = Path(__file__).resolve().parent.parent.parent / "auth" / "users.json"
auth_service = AuthService(users_path)

bearer_scheme = HTTPBearer(auto_error=False)


def _handle_unauthorized(message: str = "Not authenticated") -> None:
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=message)


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Optional[str]:
    if not credentials:
        return None
    username = auth_service.verify_token(credentials.credentials)
    if not username:
        _handle_unauthorized()
    return username


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if not credentials:
        _handle_unauthorized()
    username = auth_service.verify_token(credentials.credentials)
    if not username:
        _handle_unauthorized()
    return username
