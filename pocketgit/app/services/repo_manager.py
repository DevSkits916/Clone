from __future__ import annotations

import random
import string
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import HTTPException, status

from .git_repo import GitRepo


class RepoManager:
    def __init__(self, base_path: Path):
        self.base_path = base_path
        self.base_path.mkdir(parents=True, exist_ok=True)

    def generate_repo_id(self, length: int = 10) -> str:
        alphabet = string.ascii_lowercase + string.digits
        while True:
            repo_id = "".join(random.choice(alphabet) for _ in range(length))
            if not (self.base_path / repo_id).exists():
                return repo_id

    def get_repo(self, repo_id: str) -> GitRepo:
        try:
            return GitRepo(repo_id, self.base_path)
        except FileNotFoundError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    def clone_repository(self, url: str, branch: Optional[str], auth: Optional[Dict[str, str]]) -> GitRepo:
        repo_id = self.generate_repo_id()
        repo = GitRepo.clone_to_path(repo_id, self.base_path, url, branch=branch, auth=auth)
        return repo

    def list_repositories(self) -> List[GitRepo]:
        repos: List[GitRepo] = []
        for entry in sorted(self.base_path.iterdir() if self.base_path.exists() else []):
            if not entry.is_dir():
                continue
            try:
                repos.append(GitRepo(entry.name, self.base_path))
            except Exception:
                continue
        return repos


base_repo_path = Path(__file__).resolve().parent.parent.parent / "repos"
repo_manager = RepoManager(base_repo_path)
