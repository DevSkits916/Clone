from __future__ import annotations

from fastapi import APIRouter, Path, Query

from ..models.response_schemas import SearchResponse, SearchResult
from ..services.repo_manager import repo_manager

router = APIRouter()


@router.get("/repo/{repo_id}/search", response_model=SearchResponse)
def search(
    repo_id: str = Path(..., alias="repoId"),
    q: str = Query(..., min_length=1),
) -> SearchResponse:
    repo = repo_manager.get_repo(repo_id)
    results = repo.search(q)
    return SearchResponse(results=[SearchResult(**result) for result in results])
