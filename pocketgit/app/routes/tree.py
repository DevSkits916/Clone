from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from typing import Optional

from ..models.response_schemas import TreeEntry, TreeResponse
from ..services.auth_service import get_optional_current_user
from ..services.repo_manager import repo_manager
from ..utils.fs_utils import InvalidPathError

router = APIRouter()


@router.get("/repo/{repo_id}/tree", response_model=TreeResponse)
def browse_tree(
    repo_id: str = Path(..., alias="repoId"),
    path: str | None = Query(default=None),
    current_user: Optional[str] = Depends(get_optional_current_user),
) -> TreeResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        entries = repo.get_tree(path)
    except InvalidPathError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    tree_entries = [TreeEntry(**entry) for entry in entries]
    return TreeResponse(path=path or "", entries=tree_entries)
