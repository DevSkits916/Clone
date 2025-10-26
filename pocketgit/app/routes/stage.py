from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path

from ..models.request_schemas import StageRequest
from ..models.response_schemas import OkResponse
from ..services.repo_manager import repo_manager
from ..utils.fs_utils import InvalidPathError

router = APIRouter()


@router.post("/repo/{repo_id}/stage", response_model=OkResponse)
def stage_files(payload: StageRequest, repo_id: str = Path(..., alias="repoId")) -> OkResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        repo.stage(payload.paths)
    except InvalidPathError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return OkResponse()


@router.post("/repo/{repo_id}/unstage", response_model=OkResponse)
def unstage_files(payload: StageRequest, repo_id: str = Path(..., alias="repoId")) -> OkResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        repo.unstage(payload.paths)
    except InvalidPathError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return OkResponse()
