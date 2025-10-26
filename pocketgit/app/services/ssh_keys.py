from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List, Optional
from uuid import uuid4


@dataclass
class SSHKeyMetadata:
    id: str
    name: Optional[str]
    created_at: str

    @classmethod
    def from_file(cls, path: Path) -> Optional["SSHKeyMetadata"]:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        key_id = data.get("id") or path.stem
        name = data.get("name")
        created_at = data.get("createdAt") or data.get("created_at")
        if not created_at:
            created_at = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
        return cls(id=key_id, name=name, created_at=created_at)

    def to_file(self, path: Path) -> None:
        payload = {"id": self.id, "name": self.name, "createdAt": self.created_at}
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


class SSHKeyManager:
    def __init__(self, base_path: Path):
        self.base_path = base_path
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _key_path(self, key_id: str) -> Path:
        return self.base_path / f"{key_id}.pem"

    def _metadata_path(self, key_id: str) -> Path:
        return self.base_path / f"{key_id}.json"

    def list_keys(self) -> List[SSHKeyMetadata]:
        keys: List[SSHKeyMetadata] = []
        for meta_path in sorted(self.base_path.glob("*.json")):
            metadata = SSHKeyMetadata.from_file(meta_path)
            if metadata:
                keys.append(metadata)
        return keys

    def save_key(self, private_key: str, name: Optional[str]) -> SSHKeyMetadata:
        key_id = uuid4().hex
        key_path = self._key_path(key_id)
        meta_path = self._metadata_path(key_id)
        normalized_key = private_key.strip() + "\n"
        key_path.write_text(normalized_key, encoding="utf-8")
        os.chmod(key_path, 0o600)
        created_at = datetime.now(tz=timezone.utc).isoformat()
        metadata = SSHKeyMetadata(id=key_id, name=name, created_at=created_at)
        metadata.to_file(meta_path)
        return metadata

    def delete_key(self, key_id: str) -> None:
        for path in self._iter_key_files(key_id):
            try:
                path.unlink()
            except FileNotFoundError:
                continue

    def _iter_key_files(self, key_id: str) -> Iterable[Path]:
        yield self._key_path(key_id)
        yield self._metadata_path(key_id)

    def get_env_for_key(self, key_id: Optional[str]) -> Optional[dict]:
        if not key_id:
            return None
        key_path = self._key_path(key_id)
        if not key_path.exists():
            return None
        env = os.environ.copy()
        env["GIT_SSH_COMMAND"] = f"ssh -i \"{key_path}\" -o StrictHostKeyChecking=no"
        return env

    def get_key_path(self, key_id: str) -> Path:
        key_path = self._key_path(key_id)
        if not key_path.exists():
            raise FileNotFoundError(f"SSH key {key_id} not found")
        return key_path


keys_base_path = Path(__file__).resolve().parent.parent / "keys"
ssh_key_manager = SSHKeyManager(keys_base_path)
