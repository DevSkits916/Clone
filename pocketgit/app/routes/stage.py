from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path

from ..models.request_schemas import StageRequest
from ..models.response_schemas import OkResponse
from ..services.activity_log import activity_logger
from ..services.auth_service import get_current_user
from ..services.repo_manager import repo_manager
from ..utils.fs_utils import InvalidPathError

router = APIRouter()


@router.post("/repo/{repo_id}/stage", response_model=OkResponse)
def stage_files(
    payload: StageRequest,
    repo_id: str = Path(..., alias="repoId"),
    current_user: str = Depends(get_current_user),
) -> OkResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        repo.stage(payload.paths)
    except InvalidPathError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    activity_logger.append(
        repo_id,
        "stage",
        current_user,
        branch=repo.get_current_branch(),
        paths=list(payload.paths),
    )
    return OkResponse()


@router.post("/repo/{repo_id}/unstage", response_model=OkResponse)
def unstage_files(
    payload: StageRequest,
    repo_id: str = Path(..., alias="repoId"),
    current_user: str = Depends(get_current_user),
) -> OkResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        repo.unstage(payload.paths)
    except InvalidPathError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    activity_logger.append(
        repo_id,
        "unstage",
        current_user,
        branch=repo.get_current_branch(),
        paths=list(payload.paths),
    )
    return OkResponse()
