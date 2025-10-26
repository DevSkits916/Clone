from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from git import GitCommandError

from ..services.activity_log import activity_logger
from ..services.auth_service import get_current_user
from ..services.repo_manager import repo_manager


router = APIRouter()


@router.get("/shortcut/push")
def shortcut_push(
    repo_id: str = Query(..., alias="repoId"),
    current_user: str = Depends(get_current_user),
) -> dict:
    repo = repo_manager.get_repo(repo_id)
    try:
        pushed = repo.push()
    except (GitCommandError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    activity_logger.append(
        repo_id,
        "shortcut_push",
        current_user,
        branch=repo.get_current_branch(),
        pushed=pushed,
    )
    return {"ok": True, "pushed": pushed}


@router.get("/shortcut/fetch")
def shortcut_fetch(
    repo_id: str = Query(..., alias="repoId"),
    current_user: str = Depends(get_current_user),
) -> dict:
    repo = repo_manager.get_repo(repo_id)
    try:
        repo.fetch()
    except (GitCommandError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    activity_logger.append(
        repo_id,
        "shortcut_fetch",
        current_user,
        branch=repo.get_current_branch(),
    )
    return {"ok": True}


@router.get("/shortcut/commit-and-push")
def shortcut_commit_and_push(
    repo_id: str = Query(..., alias="repoId"),
    msg: str = Query(..., alias="msg"),
    name: str = Query(..., alias="name"),
    email: str = Query(..., alias="email"),
    current_user: str = Depends(get_current_user),
) -> dict:
    if not msg.strip():
        raise HTTPException(status_code=400, detail="Commit message is required")

    repo = repo_manager.get_repo(repo_id)
    try:
        repo.stage_all()
        if not repo.has_staged_changes():
            raise HTTPException(status_code=400, detail="No changes to commit")
        commit_hash = repo.commit(msg, name, email)
        pushed = repo.push()
    except HTTPException:
        raise
    except (GitCommandError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    activity_logger.append(
        repo_id,
        "shortcut_commit_push",
        current_user,
        branch=repo.get_current_branch(),
        msg=msg,
        hash=commit_hash,
        pushed=bool(pushed),
    )
    return {"ok": True, "commitHash": commit_hash, "pushed": bool(pushed)}
