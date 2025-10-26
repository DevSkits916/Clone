from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


class ActivityLogger:
    LOG_FILENAME = "activity.log"

    def __init__(self, base_path: Path):
        self.base_path = base_path

    def _log_path(self, repo_id: str) -> Path:
        repo_path = self.base_path / repo_id
        repo_path.mkdir(parents=True, exist_ok=True)
        return repo_path / self.LOG_FILENAME

    def append(
        self,
        repo_id: str,
        action: str,
        user: str,
        branch: Optional[str] = None,
        **details: Any,
    ) -> None:
        entry: Dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "action": action,
            "user": user,
        }
        if branch:
            entry["branch"] = branch
        for key, value in details.items():
            if value is None:
                continue
            entry[key] = value
        path = self._log_path(repo_id)
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=False))
            handle.write("\n")

    def read(self, repo_id: str, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        path = self._log_path(repo_id)
        if not path.exists():
            return []
        entries: List[Dict[str, Any]] = []
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    payload = json.loads(line)
                except json.JSONDecodeError:
                    continue
                entries.append(payload)
        if limit is not None:
            return entries[-limit:]
        return entries


repos_base_path = Path(__file__).resolve().parent.parent.parent / "repos"
activity_logger = ActivityLogger(repos_base_path)
