from __future__ import annotations


def combine_diffs(staged: str, unstaged: str) -> str:
    """Combine staged and unstaged diffs into a single unified diff blob."""

    parts: list[str] = []
    if staged.strip():
        parts.append("# Staged changes\n" + staged.strip())
    if unstaged.strip():
        parts.append("# Unstaged changes\n" + unstaged.strip())
    return "\n\n".join(parts)
