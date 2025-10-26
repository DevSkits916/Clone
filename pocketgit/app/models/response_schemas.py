from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class CloneResponse(BaseModel):
    repoId: str
    name: str
    defaultBranch: str
    branches: List[str]


class RepoSummary(BaseModel):
    repoId: str
    name: str
    currentBranch: Optional[str]
    ahead: int
    behind: int


class BranchListResponse(BaseModel):
    current: Optional[str]
    branches: List[str]


class OkResponse(BaseModel):
    ok: bool = True


class BranchSwitchResponse(OkResponse):
    current: str


class TreeEntry(BaseModel):
    type: str
    name: str
    size: Optional[int] = None


class TreeResponse(BaseModel):
    path: str
    entries: List[TreeEntry]


class FileResponse(BaseModel):
    path: str
    content: str


class StatusEntry(BaseModel):
    path: str
    status: str


class StatusResponse(BaseModel):
    branch: Optional[str]
    staged: List[StatusEntry]
    unstaged: List[StatusEntry]
    untracked: List[StatusEntry]
    ahead: int
    behind: int


class DiffResponse(BaseModel):
    diff: str


class CommitResponse(OkResponse):
    commitHash: str


class PushResponse(OkResponse):
    pushed: bool


class MergeResponse(OkResponse):
    result: str


class SearchResult(BaseModel):
    path: str
    line: int
    preview: str


class SearchResponse(BaseModel):
    results: List[SearchResult]
