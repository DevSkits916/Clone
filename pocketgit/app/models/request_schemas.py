from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class AuthCredentials(BaseModel):
    username: str
    password: str


class CloneRequest(BaseModel):
    url: str
    branch: Optional[str] = None
    auth: Optional[AuthCredentials] = None


class BranchCreateRequest(BaseModel):
    name: str
    from_: str = Field(alias="from")

    class Config:
        allow_population_by_field_name = True


class BranchSwitchRequest(BaseModel):
    name: str


class BranchDeleteRequest(BaseModel):
    name: str


class FileWriteRequest(BaseModel):
    path: str
    content: str


class StageRequest(BaseModel):
    paths: List[str]


class CommitRequest(BaseModel):
    message: str
    authorName: str
    authorEmail: str


class MergeRequest(BaseModel):
    fromBranch: str
    strategy: str

    def validate_strategy(self) -> str:
        if self.strategy not in {"merge", "rebase"}:
            raise ValueError("strategy must be 'merge' or 'rebase'")
        return self.strategy

    def model_post_init(self, __context: object) -> None:  # type: ignore[override]
        self.validate_strategy()
