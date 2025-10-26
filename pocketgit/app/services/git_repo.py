from __future__ import annotations

import base64
import fnmatch
import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional
from urllib.parse import urlparse, urlunparse

from git import Actor, GitCommandError, Repo

from ..utils.diff_utils import combine_diffs
from ..utils.fs_utils import InvalidPathError, ensure_within_repo
from .secret_manager import secret_manager
from .ssh_keys import ssh_key_manager


@dataclass
class RepoMetadata:
    repo_id: str
    remote_url: Optional[str]
    default_branch: Optional[str]
    name: Optional[str] = None
    ssh_key_id: Optional[str] = None

    @classmethod
    def from_file(cls, path: Path, repo_id: str) -> "RepoMetadata | None":
        if not path.exists():
            return None
        data = json.loads(path.read_text())
        return cls(
            repo_id=repo_id,
            remote_url=data.get("remote"),
            default_branch=data.get("default_branch"),
            name=data.get("name"),
            ssh_key_id=data.get("ssh_key_id"),
        )

    def to_file(self, path: Path) -> None:
        payload = {
            "repoId": self.repo_id,
            "remote": self.remote_url,
            "default_branch": self.default_branch,
            "name": self.name,
            "ssh_key_id": self.ssh_key_id,
        }
        path.write_text(json.dumps(payload, indent=2))
        git_repo_cls = globals().get("GitRepo")
        if git_repo_cls:
            try:
                git_repo_cls.ensure_metadata_ignored(path.parent)
            except OSError:
                pass


class GitRepo:
    METADATA_FILENAME = "pocketgit.json"

    def __init__(self, repo_id: str, base_path: Path):
        self.repo_id = repo_id
        self.base_path = base_path
        self.path = base_path / repo_id
        if not self.path.exists():
            raise FileNotFoundError(f"Repository {repo_id} not found")
        self.repo = Repo(self.path)

    @property
    def metadata_path(self) -> Path:
        return self.path / self.METADATA_FILENAME

    def read_metadata(self) -> RepoMetadata | None:
        return RepoMetadata.from_file(self.metadata_path, self.repo_id)

    @classmethod
    def clone_to_path(
        cls,
        repo_id: str,
        base_path: Path,
        url: str,
        branch: Optional[str] = None,
        auth: Optional[dict] = None,
        ssh_key_id: Optional[str] = None,
    ) -> "GitRepo":
        target_path = base_path / repo_id
        if target_path.exists():
            raise FileExistsError(f"Target path {target_path} already exists")
        target_path.parent.mkdir(parents=True, exist_ok=True)

        clone_url = cls._apply_auth_to_url(url, auth)
        env = ssh_key_manager.get_env_for_key(ssh_key_id) if ssh_key_id else None
        if env and not (url.startswith("git@") or urlparse(url).scheme in {"ssh"}):
            env = None
        repo = Repo.clone_from(clone_url, target_path, env=env)

        if branch:
            repo.git.checkout(branch)

        default_branch = None
        if not repo.head.is_detached:
            default_branch = repo.active_branch.name

        metadata = RepoMetadata(
            repo_id=repo_id,
            remote_url=url,
            default_branch=default_branch,
            ssh_key_id=ssh_key_id if env else None,
        )
        metadata.to_file(target_path / cls.METADATA_FILENAME)
        return cls(repo_id, base_path)

    @classmethod
    def ensure_metadata_ignored(cls, repo_path: Path) -> None:
        exclude_path = repo_path / ".git" / "info" / "exclude"
        try:
            exclude_path.parent.mkdir(parents=True, exist_ok=True)
            existing = ""
            if exclude_path.exists():
                existing = exclude_path.read_text(encoding="utf-8")
                lines = {line.strip() for line in existing.splitlines() if line.strip()}
                if cls.METADATA_FILENAME in lines:
                    return
            with exclude_path.open("a", encoding="utf-8") as handle:
                if existing and not existing.endswith("\n"):
                    handle.write("\n")
                handle.write(f"{cls.METADATA_FILENAME}\n")
        except OSError:
            # If we fail to write to the exclude file, continue without raising.
            pass

    @staticmethod
    def _apply_auth_to_url(url: str, auth: Optional[dict]) -> str:
        if not auth:
            return url
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            return url
        netloc = parsed.netloc
        credentials = f"{auth['username']}:{auth['password']}"
        if "@" in netloc:
            netloc = netloc.split("@", 1)[-1]
        netloc = f"{credentials}@{netloc}"
        return urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))

    def _build_git_env(self) -> Optional[dict]:
        metadata = self.read_metadata()
        if not metadata or not metadata.ssh_key_id:
            return None
        remote_url = metadata.remote_url
        if not remote_url:
            try:
                remote = self.get_default_remote()
                remote_urls = list(remote.urls)
                if remote_urls:
                    remote_url = remote_urls[0]
            except Exception:
                remote_url = None
        if not remote_url:
            return None
        if remote_url.startswith("git@") or remote_url.startswith("ssh://"):
            return ssh_key_manager.get_env_for_key(metadata.ssh_key_id)
        return None

    def _get_remote_url(self, remote) -> Optional[str]:
        try:
            urls = list(remote.urls)
        except Exception:
            urls = []
        if urls:
            return urls[0]
        metadata = self.read_metadata()
        if metadata and metadata.remote_url:
            return metadata.remote_url
        return None

    def _get_http_auth_url(self, remote=None) -> Optional[str]:
        base_url = None
        if remote is not None:
            base_url = self._get_remote_url(remote)
        if not base_url:
            metadata = self.read_metadata()
            if metadata and metadata.remote_url:
                base_url = metadata.remote_url
        if not base_url or not base_url.startswith(("http://", "https://")):
            return None
        credentials = secret_manager.get_http_credentials(self.repo_id)
        if not credentials:
            return None
        return self._apply_auth_to_url(base_url, credentials)

    def get_name(self) -> str:
        metadata = self.read_metadata()
        if metadata and metadata.name:
            return metadata.name
        return Path(self.repo.working_tree_dir).name

    def get_default_remote(self):
        if not self.repo.remotes:
            raise ValueError("No remotes configured for this repository")
        try:
            return self.repo.remotes.origin
        except AttributeError:
            return self.repo.remotes[0]

    def get_current_branch(self) -> Optional[str]:
        if self.repo.head.is_detached:
            return None
        return self.repo.active_branch.name

    def list_branches(self) -> List[str]:
        return sorted(branch.name for branch in self.repo.branches)

    def switch_branch(self, name: str) -> str:
        self.repo.git.checkout(name)
        return name

    def create_branch(self, name: str, from_ref: str) -> None:
        self.repo.git.branch(name, from_ref)

    def delete_branch(self, name: str) -> None:
        self.repo.git.branch("-D", name)

    def get_tree(self, path: Optional[str]) -> List[dict]:
        root = Path(self.repo.working_tree_dir)
        target = ensure_within_repo(root, path)
        if not target.exists():
            return []
        entries: List[dict] = []
        for child in sorted(target.iterdir(), key=lambda c: (c.is_file(), c.name.lower())):
            if child.name == ".git":
                continue
            if child.is_dir():
                entries.append({"type": "dir", "name": child.name})
            else:
                entries.append({"type": "file", "name": child.name, "size": child.stat().st_size})
        return entries

    def read_file(self, path: str) -> str:
        root = Path(self.repo.working_tree_dir)
        target = ensure_within_repo(root, path)
        if not target.exists() or not target.is_file():
            raise FileNotFoundError(path)
        return target.read_text(encoding="utf-8")

    def read_file_bytes(self, path: str) -> bytes:
        root = Path(self.repo.working_tree_dir)
        target = ensure_within_repo(root, path)
        if not target.exists() or not target.is_file():
            raise FileNotFoundError(path)
        return target.read_bytes()

    def write_file(self, path: str, content: str) -> None:
        root = Path(self.repo.working_tree_dir)
        target = ensure_within_repo(root, path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    def stage(self, paths: Iterable[str]) -> None:
        root = Path(self.repo.working_tree_dir)
        resolved_paths = [str(ensure_within_repo(root, p)) for p in paths]
        self.repo.index.add(resolved_paths)

    def stage_all(self) -> None:
        self.repo.git.add(A=True)

    def unstage(self, paths: Iterable[str]) -> None:
        root = Path(self.repo.working_tree_dir)
        resolved_paths = [str(ensure_within_repo(root, p)) for p in paths]
        if resolved_paths:
            self.repo.git.restore("--staged", *resolved_paths)

    def get_staged_diffs(self):
        if self.repo.head.is_valid():
            return list(self.repo.index.diff("HEAD"))
        return list(self.repo.index.diff(None, staged=True))

    def has_staged_changes(self) -> bool:
        if self.repo.head.is_valid():
            return bool(self.repo.index.diff("HEAD"))
        return bool(self.repo.index.entries)

    def get_status(self) -> dict:
        branch = self.get_current_branch()
        staged_entries = []
        for diff in self.get_staged_diffs():
            staged_entries.append({"path": diff.b_path or diff.a_path, "status": diff.change_type})

        unstaged_entries = []
        for diff in self.repo.index.diff(None):
            unstaged_entries.append({"path": diff.b_path or diff.a_path, "status": diff.change_type})

        untracked_entries = [{"path": path, "status": "untracked"} for path in self.repo.untracked_files]

        ahead, behind = self.get_ahead_behind()

        return {
            "branch": branch,
            "staged": staged_entries,
            "unstaged": unstaged_entries,
            "untracked": untracked_entries,
            "ahead": ahead,
            "behind": behind,
        }

    def get_diff(self) -> str:
        try:
            staged = self.repo.git.diff("--cached")
        except GitCommandError:
            staged = ""
        try:
            unstaged = self.repo.git.diff()
        except GitCommandError:
            unstaged = ""
        return combine_diffs(staged, unstaged)

    def list_lfs_pointers(self) -> List[dict]:
        entries: List[dict] = []
        try:
            result = subprocess.run(
                ["git", "lfs", "ls-files", "--json"],
                cwd=self.path,
                capture_output=True,
                text=True,
                check=True,
            )
            for line in result.stdout.splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    payload = json.loads(line)
                except json.JSONDecodeError:
                    continue
                path = payload.get("name") or payload.get("path")
                if not path:
                    continue
                pointer_info = {
                    "path": path,
                    "oid": payload.get("oid"),
                    "size": payload.get("size"),
                    "tracked": payload.get("tracked", True),
                    "present": payload.get("present"),
                }
                entries.append(pointer_info)
        except FileNotFoundError:
            entries = []
        except subprocess.CalledProcessError:
            entries = []

        if entries:
            return entries

        return self._list_lfs_from_gitattributes()

    def _list_lfs_from_gitattributes(self) -> List[dict]:
        patterns = self._collect_lfs_patterns()
        if not patterns:
            return []
        try:
            tracked_files = self.repo.git.ls_files().splitlines()
        except GitCommandError:
            return []
        root = Path(self.repo.working_tree_dir)
        matches: List[dict] = []
        for file_path in tracked_files:
            if any(fnmatch.fnmatch(file_path, pattern) for pattern in patterns):
                pointer = self._read_pointer_metadata(root / file_path)
                if pointer:
                    matches.append(pointer)
        return matches

    def _collect_lfs_patterns(self) -> List[str]:
        patterns: List[str] = []
        attr_path = self.path / ".gitattributes"
        if not attr_path.exists():
            return patterns
        try:
            lines = attr_path.read_text(encoding="utf-8").splitlines()
        except OSError:
            return patterns
        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            parts = stripped.split()
            if len(parts) < 2:
                continue
            pattern, *attributes = parts
            if any("filter=lfs" in attribute for attribute in attributes):
                patterns.append(pattern)
        return patterns

    def _read_pointer_metadata(self, pointer_path: Path) -> Optional[dict]:
        try:
            text = pointer_path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            return None
        if "git-lfs" not in text:
            return None
        oid = None
        size_value: Optional[int] = None
        for line in text.splitlines():
            if line.startswith("oid "):
                oid = line.split("sha256:", 1)[-1].strip()
            if line.startswith("size "):
                try:
                    size_value = int(line.split()[1])
                except (IndexError, ValueError):
                    size_value = None
        if not oid:
            return None
        root = Path(self.repo.working_tree_dir)
        relative_path = pointer_path.relative_to(root)
        return {
            "path": str(relative_path),
            "oid": oid,
            "size": size_value,
            "tracked": True,
            "present": False,
        }

    def fetch_lfs_file(self, path: str) -> dict:
        env = self._build_git_env()
        try:
            subprocess.run(
                ["git", "lfs", "pull", "--include", path, "--exclude", ""],
                cwd=self.path,
                check=True,
                capture_output=True,
                env=env,
            )
        except FileNotFoundError as exc:
            raise RuntimeError("Git LFS is not installed on the server") from exc
        except subprocess.CalledProcessError as exc:
            stderr = exc.stderr.decode() if isinstance(exc.stderr, bytes) else exc.stderr
            message = stderr or "Failed to fetch LFS file"
            raise RuntimeError(message) from exc

        binary = self.read_file_bytes(path)
        encoded = base64.b64encode(binary).decode("ascii")
        return {
            "path": path,
            "encoding": "base64",
            "content": encoded,
            "size": len(binary),
        }

    def commit(self, message: str, author_name: str, author_email: str) -> str:
        author = Actor(author_name, author_email)
        commit = self.repo.index.commit(message, author=author, committer=author)
        return commit.hexsha

    def push(self) -> bool:
        remote = self.get_default_remote()
        env = self._build_git_env()
        if not env:
            auth_url = self._get_http_auth_url(remote)
            if auth_url:
                result = self.repo.git.push(auth_url)
                return bool(result)
        results = remote.push(env=env) if env else remote.push()
        return bool(results)

    def fetch(self) -> None:
        remote = self.get_default_remote()
        env = self._build_git_env()
        if not env:
            auth_url = self._get_http_auth_url(remote)
            if auth_url:
                self.repo.git.fetch(auth_url)
                return
        if env:
            remote.fetch(env=env)
        else:
            remote.fetch()

    def merge_or_rebase(self, from_branch: str, strategy: str) -> str:
        if strategy == "merge":
            self.repo.git.merge(from_branch)
            return "merged"
        if strategy == "rebase":
            self.repo.git.rebase(from_branch)
            return "rebased"
        raise ValueError("Unknown strategy")

    def search(self, query: str) -> List[dict]:
        if not query:
            return []
        results: List[dict] = []
        tracked_files = self.repo.git.ls_files().splitlines()
        root = Path(self.repo.working_tree_dir)
        for file_path in tracked_files:
            full_path = root / file_path
            if not full_path.exists():
                continue
            with full_path.open("r", encoding="utf-8", errors="ignore") as handle:
                for index, line in enumerate(handle, start=1):
                    if query in line:
                        preview = line.strip()
                        results.append({"path": file_path, "line": index, "preview": preview})
        return results

    def get_ahead_behind(self) -> tuple[int, int]:
        branch = self.get_current_branch()
        if not branch:
            return 0, 0
        try:
            tracking = self.repo.active_branch.tracking_branch()
        except TypeError:
            tracking = None
        if not tracking:
            return 0, 0
        try:
            tracking_ref = tracking.name
            result = subprocess.run(
                [
                    "git",
                    "rev-list",
                    "--left-right",
                    "--count",
                    f"{tracking_ref}...HEAD",
                ],
                cwd=self.path,
                capture_output=True,
                text=True,
                check=True,
            )
            behind_str, ahead_str = result.stdout.strip().split()
            ahead = int(ahead_str)
            behind = int(behind_str)
            return ahead, behind
        except Exception:
            return 0, 0

    def get_summary(self) -> dict:
        branch = self.get_current_branch()
        ahead, behind = self.get_ahead_behind()
        return {
            "repoId": self.repo_id,
            "name": self.get_name(),
            "currentBranch": branch,
            "ahead": ahead,
            "behind": behind,
        }
