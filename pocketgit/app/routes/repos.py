from __future__ import annotations

from fastapi import APIRouter, Depends

from ..models.response_schemas import RepoSummary
from ..services.auth_service import get_optional_current_user
from ..services.repo_manager import repo_manager

router = APIRouter()


@router.get("/repos", response_model=list[RepoSummary])
def list_repositories(current_user: str | None = Depends(get_optional_current_user)) -> list[RepoSummary]:
    repos = repo_manager.list_repositories()
    summaries = [RepoSummary(**repo.get_summary()) for repo in repos]
    return summaries
