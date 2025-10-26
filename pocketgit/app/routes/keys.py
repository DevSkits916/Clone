from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..models.request_schemas import SSHKeyUploadRequest
from ..models.response_schemas import OkResponse, SSHKeyInfo, SSHKeyListResponse, SSHKeyUploadResponse
from ..services.auth_service import get_current_user, get_optional_current_user
from ..services.ssh_keys import ssh_key_manager

router = APIRouter()


@router.get("/keys/list", response_model=SSHKeyListResponse)
def list_keys(current_user: str | None = Depends(get_optional_current_user)) -> SSHKeyListResponse:
    keys = [
        SSHKeyInfo(id=meta.id, name=meta.name, createdAt=meta.created_at)
        for meta in ssh_key_manager.list_keys()
    ]
    return SSHKeyListResponse(keys=keys)


@router.post("/keys/upload", response_model=SSHKeyUploadResponse)
def upload_key(
    payload: SSHKeyUploadRequest,
    current_user: str = Depends(get_current_user),
) -> SSHKeyUploadResponse:
    private_key = payload.privateKey.strip()
    if not private_key or "BEGIN" not in private_key:
        raise HTTPException(status_code=400, detail="Invalid SSH private key contents")
    metadata = ssh_key_manager.save_key(private_key, payload.name)
    key = SSHKeyInfo(id=metadata.id, name=metadata.name, createdAt=metadata.created_at)
    return SSHKeyUploadResponse(key=key)


@router.delete("/keys/{key_id}", response_model=OkResponse)
def delete_key(key_id: str, current_user: str = Depends(get_current_user)) -> OkResponse:
    try:
        key_path = ssh_key_manager.get_key_path(key_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Key not found") from exc
    if not key_path.exists():
        raise HTTPException(status_code=404, detail="Key not found")
    ssh_key_manager.delete_key(key_id)
    return OkResponse()
