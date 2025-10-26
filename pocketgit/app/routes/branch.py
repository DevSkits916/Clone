from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path
from git import GitCommandError

from ..models.request_schemas import BranchCreateRequest, BranchDeleteRequest, BranchSwitchRequest
from ..models.response_schemas import BranchListResponse, BranchSwitchResponse, OkResponse
from ..services.repo_manager import repo_manager

router = APIRouter()


@router.get("/repo/{repo_id}/branches", response_model=BranchListResponse)
def list_branches(repo_id: str = Path(..., alias="repoId")) -> BranchListResponse:
    repo = repo_manager.get_repo(repo_id)
    return BranchListResponse(current=repo.get_current_branch(), branches=repo.list_branches())


@router.post("/repo/{repo_id}/branch/create", response_model=OkResponse)
def create_branch(payload: BranchCreateRequest, repo_id: str = Path(..., alias="repoId")) -> OkResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        repo.create_branch(payload.name, payload.from_)
    except GitCommandError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return OkResponse()


@router.post("/repo/{repo_id}/branch/switch", response_model=BranchSwitchResponse)
def switch_branch(payload: BranchSwitchRequest, repo_id: str = Path(..., alias="repoId")) -> BranchSwitchResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        current = repo.switch_branch(payload.name)
    except GitCommandError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return BranchSwitchResponse(ok=True, current=current)


@router.delete("/repo/{repo_id}/branch", response_model=OkResponse)
def delete_branch(payload: BranchDeleteRequest, repo_id: str = Path(..., alias="repoId")) -> OkResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        repo.delete_branch(payload.name)
    except GitCommandError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return OkResponse()
