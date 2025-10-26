from __future__ import annotations

from fastapi import APIRouter

from ..models.response_schemas import RepoSummary
from ..services.repo_manager import repo_manager

router = APIRouter()


@router.get("/repos", response_model=list[RepoSummary])
def list_repositories() -> list[RepoSummary]:
    repos = repo_manager.list_repositories()
    summaries = [RepoSummary(**repo.get_summary()) for repo in repos]
    return summaries
