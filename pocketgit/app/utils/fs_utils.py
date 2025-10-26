from __future__ import annotations

from pathlib import Path


class InvalidPathError(ValueError):
    """Raised when a requested path resolves outside of the repository root."""


def ensure_within_repo(root: Path, relative_path: str | None) -> Path:
    """Resolve a relative path within the repository, preventing traversal."""

    if relative_path in (None, "", "."):
        return root

    target = (root / relative_path).resolve()
    if not str(target).startswith(str(root.resolve())):
        raise InvalidPathError("Path escapes repository root")
    return target
