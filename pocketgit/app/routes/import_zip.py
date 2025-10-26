from __future__ import annotations

import io
import shutil
from pathlib import Path
from typing import Optional, Set
from zipfile import BadZipFile, ZipFile

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from git import Actor, GitCommandError, Repo

from ..models.response_schemas import CloneResponse
from ..services.activity_log import activity_logger
from ..services.auth_service import get_current_user
from ..services.git_repo import GitRepo, RepoMetadata
from ..services.repo_manager import repo_manager


router = APIRouter()

IGNORE_ROOTS: Set[str] = {"__MACOSX"}


def _validate_member_path(member: str) -> Path:
    path = Path(member)
    if path.is_absolute():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Zip file contains absolute paths")
    if any(part in {"..", ""} for part in path.parts):
        # Empty parts can be produced by paths like // or ./../
        cleaned_parts = [part for part in path.parts if part not in {"", "."}]
        if ".." in cleaned_parts:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Zip file contains unsafe paths")
        return Path(*cleaned_parts)
    return path


def _safe_extract(zip_file: ZipFile, destination: Path) -> set[str]:
    top_level: Set[str] = set()
    for info in zip_file.infolist():
        sanitized = _validate_member_path(info.filename)
        if not sanitized.parts:
            continue
        if sanitized.parts[0] in IGNORE_ROOTS:
            continue
        top_level.add(sanitized.parts[0])
        zip_file.extract(info, destination)
    return top_level


def _cleanup_after_extract(path: Path) -> None:
    macos_folder = path / "__MACOSX"
    if macos_folder.exists():
        shutil.rmtree(macos_folder, ignore_errors=True)
    for ds_store in path.rglob(".DS_Store"):
        ds_store.unlink(missing_ok=True)


def _flatten_single_directory(path: Path) -> Optional[str]:
    entries = [child for child in path.iterdir() if child.name != "__MACOSX"]
    if len(entries) != 1 or not entries[0].is_dir():
        return None
    inner = entries[0]
    inner_name = inner.name
    for child in inner.iterdir():
        target = path / child.name
        shutil.move(str(child), target)
    inner.rmdir()
    return inner_name


def _validate_extracted_tree(path: Path) -> None:
    base = path.resolve()
    for child in path.rglob("*"):
        try:
            child.resolve().relative_to(base)
        except ValueError as exc:  # pragma: no cover - safety guard
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Zip file contains invalid paths") from exc


def _detect_remote_url(repo: Repo) -> Optional[str]:
    if not repo.remotes:
        return None
    try:
        return repo.remotes.origin.url
    except AttributeError:
        try:
            return repo.remotes[0].url
        except IndexError:
            return None


@router.post("/import-zip", response_model=CloneResponse)
async def import_zip(
    file: UploadFile = File(...),
    repo_name: Optional[str] = Form(None),
    current_user: str = Depends(get_current_user),
) -> CloneResponse:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing filename")

    repo_id = repo_manager.generate_repo_id()
    target_path = repo_manager.base_path / repo_id
    target_path.mkdir(parents=True, exist_ok=False)

    file_bytes = await file.read()
    if not file_bytes:
        shutil.rmtree(target_path, ignore_errors=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Zip file is empty")

    try:
        with ZipFile(io.BytesIO(file_bytes)) as archive:
            top_level = _safe_extract(archive, target_path)
    except BadZipFile as exc:
        shutil.rmtree(target_path, ignore_errors=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid zip archive") from exc
    finally:
        await file.close()

    try:
        _cleanup_after_extract(target_path)
        _validate_extracted_tree(target_path)
        flattened_name = _flatten_single_directory(target_path)

        display_name = (repo_name or "").strip()
        if not display_name:
            candidate = flattened_name or (next(iter(top_level)) if len(top_level) == 1 else None)
            if candidate:
                display_name = Path(candidate).name
            else:
                display_name = Path(file.filename).stem or repo_id

        git_dir = target_path / ".git"
        if not git_dir.exists():
            repo = Repo.init(target_path)
            repo.git.add(A=True)
            actor = Actor("Imported", "import@local")
            repo.index.commit("Initial import", author=actor, committer=actor, allow_empty=True)
        else:
            repo = Repo(target_path)

        try:
            default_branch = repo.active_branch.name
        except TypeError:
            default_branch = None

        metadata = RepoMetadata(
            repo_id=repo_id,
            remote_url=_detect_remote_url(repo),
            default_branch=default_branch,
            name=display_name,
        )
        metadata.to_file(target_path / GitRepo.METADATA_FILENAME)

        git_repo = GitRepo(repo_id, repo_manager.base_path)
        branches = git_repo.list_branches()
    except HTTPException:
        shutil.rmtree(target_path, ignore_errors=True)
        raise
    except (GitCommandError, OSError) as exc:
        shutil.rmtree(target_path, ignore_errors=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to initialize repository: {exc}") from exc
    except Exception as exc:  # noqa: BLE001
        shutil.rmtree(target_path, ignore_errors=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    response = CloneResponse(
        repoId=git_repo.repo_id,
        name=git_repo.get_name(),
        defaultBranch=metadata.default_branch or git_repo.get_current_branch() or "",
        branches=branches,
    )
    activity_logger.append(
        git_repo.repo_id,
        "import_zip",
        current_user,
        branch=response.defaultBranch or None,
        name=response.name,
    )
    return response
