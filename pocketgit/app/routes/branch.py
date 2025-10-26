from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path
from git import GitCommandError

from ..models.request_schemas import BranchCreateRequest, BranchDeleteRequest, BranchSwitchRequest
from ..models.response_schemas import BranchListResponse, BranchSwitchResponse, OkResponse
from ..services.activity_log import activity_logger
from ..services.auth_service import get_current_user, get_optional_current_user
from ..services.repo_manager import repo_manager

router = APIRouter()


@router.get("/repo/{repo_id}/branches", response_model=BranchListResponse)
def list_branches(
    repo_id: str = Path(..., alias="repoId"),
    current_user: str | None = Depends(get_optional_current_user),
) -> BranchListResponse:
    repo = repo_manager.get_repo(repo_id)
    return BranchListResponse(current=repo.get_current_branch(), branches=repo.list_branches())


@router.post("/repo/{repo_id}/branch/create", response_model=OkResponse)
def create_branch(
    payload: BranchCreateRequest,
    repo_id: str = Path(..., alias="repoId"),
    current_user: str = Depends(get_current_user),
) -> OkResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        repo.create_branch(payload.name, payload.from_)
    except GitCommandError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    activity_logger.append(
        repo_id,
        "branch_create",
        current_user,
        branch=repo.get_current_branch(),
        name=payload.name,
        from_branch=payload.from_,
    )
    return OkResponse()


@router.post("/repo/{repo_id}/branch/switch", response_model=BranchSwitchResponse)
def switch_branch(
    payload: BranchSwitchRequest,
    repo_id: str = Path(..., alias="repoId"),
    current_user: str = Depends(get_current_user),
) -> BranchSwitchResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        current = repo.switch_branch(payload.name)
    except GitCommandError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    activity_logger.append(
        repo_id,
        "branch_switch",
        current_user,
        branch=current,
        name=payload.name,
    )
    return BranchSwitchResponse(ok=True, current=current)


@router.delete("/repo/{repo_id}/branch", response_model=OkResponse)
def delete_branch(
    payload: BranchDeleteRequest,
    repo_id: str = Path(..., alias="repoId"),
    current_user: str = Depends(get_current_user),
) -> OkResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        repo.delete_branch(payload.name)
    except GitCommandError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    activity_logger.append(
        repo_id,
        "branch_delete",
        current_user,
        branch=repo.get_current_branch(),
        name=payload.name,
    )
    return OkResponse()
