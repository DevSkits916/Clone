from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Path, status

from ..models.request_schemas import SecretCreateRequest, SecretDeleteRequest
from ..models.response_schemas import OkResponse, SecretInfo, SecretListResponse
from ..services.activity_log import activity_logger
from ..services.auth_service import get_current_user
from ..services.repo_manager import repo_manager
from ..services.secret_manager import secret_manager


router = APIRouter(tags=["secrets"])


def _get_repo(repo_id: str):
    try:
        return repo_manager.get_repo(repo_id)
    except HTTPException as exc:
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            raise
        raise


@router.get("/repo/{repo_id}/secrets", response_model=SecretListResponse)
def list_secrets(
    repo_id: str = Path(..., alias="repoId"),
    current_user: str = Depends(get_current_user),
) -> SecretListResponse:
    _get_repo(repo_id)
    secrets = secret_manager.list_secrets(repo_id)
    entries = [SecretInfo(name=name, value=value) for name, value in secrets.items()]
    return SecretListResponse(secrets=entries)


@router.post("/repo/{repo_id}/secrets", response_model=OkResponse, status_code=status.HTTP_201_CREATED)
def create_secret(
    payload: SecretCreateRequest,
    repo_id: str = Path(..., alias="repoId"),
    current_user: str = Depends(get_current_user),
) -> OkResponse:
    if not payload.name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Secret name is required")
    repo = _get_repo(repo_id)
    secret_manager.set_secret(repo_id, payload.name, payload.value)
    branch = repo.get_current_branch() if repo else None
    activity_logger.append(repo_id, "secret_add", current_user, branch=branch, name=payload.name)
    return OkResponse(ok=True)


@router.delete("/repo/{repo_id}/secrets", response_model=OkResponse)
def delete_secret(
    payload: SecretDeleteRequest,
    repo_id: str = Path(..., alias="repoId"),
    current_user: str = Depends(get_current_user),
) -> OkResponse:
    repo = _get_repo(repo_id)
    removed = secret_manager.delete_secret(repo_id, payload.name)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Secret not found")
    branch = repo.get_current_branch() if repo else None
    activity_logger.append(repo_id, "secret_remove", current_user, branch=branch, name=payload.name)
    return OkResponse(ok=True)
