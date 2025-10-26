from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path, Query

from ..models.request_schemas import FileWriteRequest
from ..models.response_schemas import FileResponse, OkResponse
from ..services.repo_manager import repo_manager
from ..utils.fs_utils import InvalidPathError

router = APIRouter()


@router.get("/repo/{repo_id}/file", response_model=FileResponse)
def read_file(repo_id: str = Path(..., alias="repoId"), path: str = Query(...)) -> FileResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        content = repo.read_file(path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="File not found") from exc
    except InvalidPathError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FileResponse(path=path, content=content)


@router.put("/repo/{repo_id}/file", response_model=OkResponse)
def write_file(payload: FileWriteRequest, repo_id: str = Path(..., alias="repoId")) -> OkResponse:
    repo = repo_manager.get_repo(repo_id)
    try:
        repo.write_file(payload.path, payload.content)
    except InvalidPathError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return OkResponse()
