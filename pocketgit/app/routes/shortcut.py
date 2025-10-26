from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from git import GitCommandError

from ..services.repo_manager import repo_manager


router = APIRouter()


@router.get("/shortcut/push")
def shortcut_push(repo_id: str = Query(..., alias="repoId")) -> dict:
    repo = repo_manager.get_repo(repo_id)
    try:
        pushed = repo.push()
    except (GitCommandError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True, "pushed": pushed}


@router.get("/shortcut/fetch")
def shortcut_fetch(repo_id: str = Query(..., alias="repoId")) -> dict:
    repo = repo_manager.get_repo(repo_id)
    try:
        repo.fetch()
    except (GitCommandError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@router.get("/shortcut/commit-and-push")
def shortcut_commit_and_push(
    repo_id: str = Query(..., alias="repoId"),
    msg: str = Query(..., alias="msg"),
    name: str = Query(..., alias="name"),
    email: str = Query(..., alias="email"),
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
    return {"ok": True, "commitHash": commit_hash, "pushed": bool(pushed)}
