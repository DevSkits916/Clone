from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path, Query

from ..models.response_schemas import LFSFetchResponse, LFSListResponse
from ..services.repo_manager import repo_manager
from ..utils.fs_utils import InvalidPathError

router = APIRouter()


@router.get("/repo/{repo_id}/lfs/list", response_model=LFSListResponse)
def list_lfs_files(repo_id: str = Path(..., alias="repoId")) -> LFSListResponse:
    repo = repo_manager.get_repo(repo_id)
    files = repo.list_lfs_pointers()
    return LFSListResponse(files=files)


@router.get("/repo/{repo_id}/lfs/fetch", response_model=LFSFetchResponse)
def fetch_lfs_file(repo_id: str = Path(..., alias="repoId"), path: str = Query(...)) -> LFSFetchResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        payload = repo.fetch_lfs_file(path)
    except InvalidPathError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="File not found") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return LFSFetchResponse(**payload)
