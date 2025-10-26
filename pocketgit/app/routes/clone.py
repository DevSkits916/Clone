from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from git import GitCommandError
from urllib.parse import urlparse, urlunparse

from ..models.request_schemas import CloneRequest
from ..models.response_schemas import CloneResponse
from ..services.activity_log import activity_logger
from ..services.auth_service import get_current_user
from ..services.repo_manager import repo_manager

router = APIRouter()


def _sanitize_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.username or parsed.password:
        netloc = parsed.hostname or ""
        if parsed.port:
            netloc = f"{netloc}:{parsed.port}"
        return urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))
    if "@" in parsed.netloc and parsed.netloc.count("@") == 1 and ":" in parsed.netloc.split("@", 1)[0]:
        netloc = parsed.netloc.split("@", 1)[1]
        return urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))
    return url


@router.post("/clone", response_model=CloneResponse)
def clone_repo(payload: CloneRequest, current_user: str = Depends(get_current_user)) -> CloneResponse:
    try:
        auth = payload.auth.dict() if payload.auth else None
        repo = repo_manager.clone_repository(payload.url, payload.branch, auth, payload.sshKeyId)
    except GitCommandError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    metadata = repo.read_metadata()
    branches = repo.list_branches()
    response = CloneResponse(
        repoId=repo.repo_id,
        name=repo.get_name(),
        defaultBranch=metadata.default_branch if metadata else repo.get_current_branch() or "",
        branches=branches,
    )
    activity_logger.append(
        repo.repo_id,
        "clone",
        current_user,
        branch=response.defaultBranch or None,
        url=_sanitize_url(payload.url),
    )
    return response
