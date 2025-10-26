from __future__ import annotations

from pathlib import Path
from typing import Iterable, List, Set

from fastapi import APIRouter, HTTPException, Path as FastAPIPath, status

from ..services.repo_manager import repo_manager


router = APIRouter()

DOC_EXTENSIONS = {".md", ".rst", ".txt", ".markdown", ".adoc"}
CONFIG_EXTENSIONS = {".json", ".yml", ".yaml", ".toml", ".ini", ".cfg", ".conf", ".env", ".properties"}
ASSET_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".svg",
    ".ico",
    ".webp",
    ".bmp",
    ".mp3",
    ".wav",
    ".mp4",
    ".mov",
    ".avi",
    ".ttf",
    ".otf",
    ".woff",
    ".woff2",
}
CODE_EXTENSIONS = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".java",
    ".c",
    ".cpp",
    ".cs",
    ".go",
    ".rb",
    ".rs",
    ".php",
    ".swift",
    ".kt",
    ".m",
    ".scala",
    ".sh",
    ".bash",
    ".ps1",
    ".html",
    ".htm",
    ".css",
}
CATEGORY_ORDER = [
    "code changes",
    "docs / text changes",
    "tests updated",
    "config updates",
    "asset updates",
]
CODE_MARKERS = [";", "{", "}", "=>", "()", " def ", "function ", "class ", "return", " if ", " for ", " while "]


def _extract_changed_lines(diff_text: str) -> List[str]:
    lines: List[str] = []
    for line in diff_text.splitlines():
        if not line:
            continue
        if line.startswith("+++") or line.startswith("---"):
            continue
        if line[0] not in {"+", "-"}:
            continue
        lines.append(line[1:])
    return lines


def _looks_like_code(lines: Iterable[str]) -> bool:
    lines_list = [line for line in lines if line.strip()]
    if not lines_list:
        return False
    code_hits = 0
    punctuation_hits = 0
    for line in lines_list:
        normalized = line.lower()
        if any(marker in normalized for marker in CODE_MARKERS):
            code_hits += 1
        punctuation_hits += sum(1 for char in line if char in "{}[]();<>")
    return code_hits >= max(1, len(lines_list) // 3) or punctuation_hits >= len(lines_list)


def _is_test_path(path: str) -> bool:
    lower = path.lower()
    path_obj = Path(lower)
    if any(part in {"test", "tests", "spec"} for part in path_obj.parts):
        return True
    stem = path_obj.stem
    return stem.startswith("test") or stem.endswith("_test") or stem.endswith("spec")


def _categorize_file(path: str, diff_text: str) -> Set[str]:
    categories: Set[str] = set()
    lower = path.lower()
    suffix = Path(lower).suffix
    if suffix in DOC_EXTENSIONS or "readme" in lower:
        categories.add("docs / text changes")
    if suffix in CONFIG_EXTENSIONS or lower.endswith("package.json") or lower.endswith("package-lock.json"):
        categories.add("config updates")
    if suffix in ASSET_EXTENSIONS:
        categories.add("asset updates")
    if _is_test_path(path):
        categories.add("tests updated")

    changed_lines = _extract_changed_lines(diff_text)
    if suffix in CODE_EXTENSIONS or _looks_like_code(changed_lines):
        categories.add("code changes")
    elif not categories:
        categories.add("docs / text changes")

    return categories


def _build_summary(paths: List[str], categories: Set[str], change_types: Set[str]) -> str:
    if not paths:
        raise ValueError("No paths provided")

    verb = "Update"
    normalized_types = {ct.upper() for ct in change_types if ct}
    if normalized_types and normalized_types <= {"A"}:
        verb = "Add"
    elif normalized_types and normalized_types <= {"D"}:
        verb = "Remove"
    elif normalized_types and normalized_types <= {"R"}:
        verb = "Rename"

    if len(paths) == 1:
        base = f"{verb} {paths[0]}"
    elif len(paths) <= 5:
        base = f"{verb} {', '.join(paths)}"
    else:
        base = f"Multiple files updated: {', '.join(paths[:3])}, …"

    ordered_categories = [category for category in CATEGORY_ORDER if category in categories]
    if ordered_categories:
        return f"{base} ({', '.join(ordered_categories)})"
    return base


@router.post("/repo/{repo_id}/suggest-commit-message")
def suggest_commit_message(repo_id: str = FastAPIPath(..., alias="repoId")) -> dict:
    repo = repo_manager.get_repo(repo_id)
    diffs = repo.get_staged_diffs()
    if not diffs:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No staged changes to summarize")

    seen_paths: Set[str] = set()
    ordered_paths: List[str] = []
    categories: Set[str] = set()
    change_types: Set[str] = set()

    for diff in diffs:
        path = diff.b_path or diff.a_path
        if not path:
            continue
        change_types.add(diff.change_type or "")
        if path not in seen_paths:
            seen_paths.add(path)
            ordered_paths.append(path)
        diff_text = diff.diff or b""
        if isinstance(diff_text, bytes):
            diff_text = diff_text.decode("utf-8", errors="ignore")
        categories.update(_categorize_file(path, diff_text))

    if not ordered_paths:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No staged changes to summarize")

    suggestion = _build_summary(ordered_paths, categories, change_types)
    return {"suggestion": suggestion}
