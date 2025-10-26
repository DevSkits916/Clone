from __future__ import annotations

from fastapi import APIRouter, HTTPException
from git import GitCommandError

from ..models.request_schemas import CloneRequest
from ..models.response_schemas import CloneResponse
from ..services.repo_manager import repo_manager

router = APIRouter()


@router.post("/clone", response_model=CloneResponse)
def clone_repo(payload: CloneRequest) -> CloneResponse:
    try:
        auth = payload.auth.dict() if payload.auth else None
        repo = repo_manager.clone_repository(payload.url, payload.branch, auth, payload.sshKeyId)
    except GitCommandError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    metadata = repo.read_metadata()
    branches = repo.list_branches()
    return CloneResponse(
        repoId=repo.repo_id,
        name=repo.get_name(),
        defaultBranch=metadata.default_branch if metadata else repo.get_current_branch() or "",
        branches=branches,
    )
