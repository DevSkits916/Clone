from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path
from git import GitCommandError

from ..models.request_schemas import OfflineCommitRequest
from ..models.response_schemas import OfflineCommitResponse
from ..services.repo_manager import repo_manager
from ..utils.fs_utils import InvalidPathError

router = APIRouter()

DEFAULT_AUTHOR_NAME = "PocketGit Offline"
DEFAULT_AUTHOR_EMAIL = "offline@pocketgit"


@router.post("/repo/{repo_id}/offline-commit", response_model=OfflineCommitResponse)
def offline_commit(payload: OfflineCommitRequest, repo_id: str = Path(..., alias="repoId")) -> OfflineCommitResponse:
    repo = repo_manager.get_repo(repo_id)

    if not payload.changes:
        return OfflineCommitResponse(ok=True, commitHash=None)

    latest_changes: dict[str, str] = {}
    for change in payload.changes:
        latest_changes[change.path] = change.content

    staged_paths: list[str] = []
    for path, content in latest_changes.items():
        try:
            repo.write_file(path, content)
            staged_paths.append(path)
        except InvalidPathError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except OSError as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    try:
        repo.stage(staged_paths)
    except InvalidPathError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not repo.has_staged_changes():
        return OfflineCommitResponse(ok=True, commitHash=None)

    message = payload.message or "Offline edits sync"
    author_name = payload.authorName or DEFAULT_AUTHOR_NAME
    author_email = payload.authorEmail or DEFAULT_AUTHOR_EMAIL

    try:
        commit_hash = repo.commit(message, author_name, author_email)
    except GitCommandError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return OfflineCommitResponse(ok=True, commitHash=commit_hash)
