from __future__ import annotations

import base64
import hashlib
import json
import os
from pathlib import Path
from typing import Dict, Optional

from cryptography.fernet import Fernet, InvalidToken


class SecretManager:
    def __init__(self, base_path: Path):
        self.base_path = base_path
        self.base_path.mkdir(parents=True, exist_ok=True)
        self._fernet = Fernet(self._load_key())

    def _key_path(self) -> Path:
        return self.base_path / ".key"

    def _load_key(self) -> bytes:
        env_value = os.getenv("POCKETGIT_SECRET_KEY")
        if env_value:
            return self._ensure_key(env_value)
        key_file = self._key_path()
        if key_file.exists():
            return key_file.read_bytes()
        key = Fernet.generate_key()
        key_file.write_bytes(key)
        return key

    @staticmethod
    def _ensure_key(value: str) -> bytes:
        raw = value.encode("utf-8")
        try:
            Fernet(raw)  # Validate key format
            return raw
        except ValueError:
            digest = hashlib.sha256(raw).digest()
            return base64.urlsafe_b64encode(digest)

    def _repo_file(self, repo_id: str) -> Path:
        return self.base_path / f"{repo_id}.json"

    def _load_repo_secrets(self, repo_id: str) -> Dict[str, str]:
        path = self._repo_file(repo_id)
        if not path.exists():
            return {}
        try:
            raw = path.read_text(encoding="utf-8")
            if not raw.strip():
                return {}
            data = json.loads(raw)
            if isinstance(data, dict):
                return {str(k): str(v) for k, v in data.items()}
            return {}
        except (OSError, json.JSONDecodeError):
            return {}

    def _save_repo_secrets(self, repo_id: str, secrets: Dict[str, str]) -> None:
        path = self._repo_file(repo_id)
        payload = json.dumps(secrets, indent=2, sort_keys=True)
        path.write_text(payload, encoding="utf-8")

    def set_secret(self, repo_id: str, name: str, value: str) -> None:
        secrets = self._load_repo_secrets(repo_id)
        encrypted = self._fernet.encrypt(value.encode("utf-8")).decode("utf-8")
        secrets[name] = encrypted
        self._save_repo_secrets(repo_id, secrets)

    def delete_secret(self, repo_id: str, name: str) -> bool:
        secrets = self._load_repo_secrets(repo_id)
        if name not in secrets:
            return False
        secrets.pop(name, None)
        self._save_repo_secrets(repo_id, secrets)
        return True

    def list_secrets(self, repo_id: str) -> Dict[str, str]:
        secrets = self._load_repo_secrets(repo_id)
        visible: Dict[str, str] = {}
        for key, encrypted in secrets.items():
            visible[key] = self._mask_secret(encrypted)
        return visible

    def _mask_secret(self, encrypted_value: str) -> str:
        try:
            decrypted = self._fernet.decrypt(encrypted_value.encode("utf-8"))
        except (InvalidToken, ValueError):
            return "******"
        plain = decrypted.decode("utf-8", errors="ignore")
        if not plain:
            return ""
        length = min(10, max(4, len(plain)))
        return "*" * length

    def get_secret_value(self, repo_id: str, name: str) -> Optional[str]:
        secrets = self._load_repo_secrets(repo_id)
        encrypted = secrets.get(name)
        if not encrypted:
            return None
        try:
            decrypted = self._fernet.decrypt(encrypted.encode("utf-8"))
        except (InvalidToken, ValueError):
            return None
        return decrypted.decode("utf-8")

    def get_http_credentials(self, repo_id: str) -> Optional[Dict[str, str]]:
        username = self.get_secret_value(repo_id, "GIT_USERNAME")
        password = self.get_secret_value(repo_id, "GIT_PASSWORD")
        token = self.get_secret_value(repo_id, "GIT_TOKEN")
        if username and (password or token):
            return {"username": username, "password": password or token}
        if token and not username:
            return {"username": "token", "password": token}
        return None


base_secrets_path = Path(__file__).resolve().parent.parent.parent / "secrets"
secret_manager = SecretManager(base_secrets_path)
