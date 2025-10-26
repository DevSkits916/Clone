from __future__ import annotations

from fastapi import APIRouter, Depends, Path

from ..models.response_schemas import ActivityEvent, ActivityResponse
from ..services.activity_log import activity_logger
from ..services.auth_service import get_current_user
from ..services.repo_manager import repo_manager


router = APIRouter(tags=["activity"])


@router.get("/repo/{repo_id}/activity", response_model=ActivityResponse)
def get_activity(
    repo_id: str = Path(..., alias="repoId"),
    current_user: str = Depends(get_current_user),
) -> ActivityResponse:
    repo_manager.get_repo(repo_id)
    events = activity_logger.read(repo_id)
    normalized: list[ActivityEvent] = []
    for event in events:
        base = {
            "ts": event.get("ts", ""),
            "action": event.get("action", ""),
            "branch": event.get("branch"),
            "msg": event.get("msg"),
            "hash": event.get("hash"),
            "user": event.get("user"),
        }
        extras = {
            key: value
            for key, value in event.items()
            if key not in {"ts", "action", "branch", "msg", "hash", "user"}
        }
        if extras:
            base["details"] = extras
        normalized.append(ActivityEvent(**base))
    return ActivityResponse(events=normalized)
