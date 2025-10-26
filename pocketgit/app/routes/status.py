from __future__ import annotations

from fastapi import APIRouter, Path

from ..models.response_schemas import DiffResponse, StatusEntry, StatusResponse
from ..services.repo_manager import repo_manager

router = APIRouter()


@router.get("/repo/{repo_id}/status", response_model=StatusResponse)
def get_status(repo_id: str = Path(..., alias="repoId")) -> StatusResponse:
    repo = repo_manager.get_repo(repo_id)
    data = repo.get_status()
    return StatusResponse(
        branch=data["branch"],
        staged=[StatusEntry(**entry) for entry in data["staged"]],
        unstaged=[StatusEntry(**entry) for entry in data["unstaged"]],
        untracked=[StatusEntry(**entry) for entry in data["untracked"]],
        ahead=data["ahead"],
        behind=data["behind"],
    )


@router.get("/repo/{repo_id}/diff", response_model=DiffResponse)
def get_diff(repo_id: str = Path(..., alias="repoId")) -> DiffResponse:
    repo = repo_manager.get_repo(repo_id)
    diff = repo.get_diff()
    return DiffResponse(diff=diff)
