from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path, Query

from ..models.response_schemas import TreeEntry, TreeResponse
from ..services.repo_manager import repo_manager
from ..utils.fs_utils import InvalidPathError

router = APIRouter()


@router.get("/repo/{repo_id}/tree", response_model=TreeResponse)
def browse_tree(
    repo_id: str = Path(..., alias="repoId"),
    path: str | None = Query(default=None),
) -> TreeResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        entries = repo.get_tree(path)
    except InvalidPathError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    tree_entries = [TreeEntry(**entry) for entry in entries]
    return TreeResponse(path=path or "", entries=tree_entries)
