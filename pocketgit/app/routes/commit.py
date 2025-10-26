from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path
from git import GitCommandError

from ..models.request_schemas import CommitRequest
from ..models.response_schemas import CommitResponse
from ..services.activity_log import activity_logger
from ..services.auth_service import get_current_user
from ..services.repo_manager import repo_manager

router = APIRouter()


@router.post("/repo/{repo_id}/commit", response_model=CommitResponse)
def create_commit(
    payload: CommitRequest,
    repo_id: str = Path(..., alias="repoId"),
    current_user: str = Depends(get_current_user),
) -> CommitResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        commit_hash = repo.commit(payload.message, payload.authorName, payload.authorEmail)
    except GitCommandError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    activity_logger.append(
        repo_id,
        "commit",
        current_user,
        branch=repo.get_current_branch(),
        msg=payload.message,
        hash=commit_hash,
    )
    return CommitResponse(ok=True, commitHash=commit_hash)
