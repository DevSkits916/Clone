from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path
from git import GitCommandError

from ..models.request_schemas import CommitRequest
from ..models.response_schemas import CommitResponse
from ..services.repo_manager import repo_manager

router = APIRouter()


@router.post("/repo/{repo_id}/commit", response_model=CommitResponse)
def create_commit(payload: CommitRequest, repo_id: str = Path(..., alias="repoId")) -> CommitResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        commit_hash = repo.commit(payload.message, payload.authorName, payload.authorEmail)
    except GitCommandError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return CommitResponse(ok=True, commitHash=commit_hash)
