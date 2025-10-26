from __future__ import annotations

from fastapi import APIRouter, Depends, Path, Query
from typing import Optional

from ..models.response_schemas import SearchResponse, SearchResult
from ..services.auth_service import get_optional_current_user
from ..services.repo_manager import repo_manager

router = APIRouter()


@router.get("/repo/{repo_id}/search", response_model=SearchResponse)
def search(
    repo_id: str = Path(..., alias="repoId"),
    q: str = Query(..., min_length=1),
    current_user: Optional[str] = Depends(get_optional_current_user),
) -> SearchResponse:
    repo = repo_manager.get_repo(repo_id)
    results = repo.search(q)
    return SearchResponse(results=[SearchResult(**result) for result in results])
