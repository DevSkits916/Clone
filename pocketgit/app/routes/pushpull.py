from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path
from git import GitCommandError

from ..models.request_schemas import MergeRequest
from ..models.response_schemas import MergeResponse, OkResponse, PushResponse
from ..services.repo_manager import repo_manager

router = APIRouter()


@router.post("/repo/{repo_id}/push", response_model=PushResponse)
def push(repo_id: str = Path(..., alias="repoId")) -> PushResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        pushed = repo.push()
    except (GitCommandError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return PushResponse(ok=True, pushed=pushed)


@router.post("/repo/{repo_id}/fetch", response_model=OkResponse)
def fetch(repo_id: str = Path(..., alias="repoId")) -> OkResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        repo.fetch()
    except (GitCommandError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return OkResponse()


@router.post("/repo/{repo_id}/merge", response_model=MergeResponse)
def merge_or_rebase(payload: MergeRequest, repo_id: str = Path(..., alias="repoId")) -> MergeResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        result = repo.merge_or_rebase(payload.fromBranch, payload.strategy)
    except GitCommandError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return MergeResponse(ok=True, result=result)
