from fastapi import FastAPI

from .routes.clone import router as clone_router
from .routes.repos import router as repos_router
from .routes.branch import router as branch_router
from .routes.tree import router as tree_router
from .routes.file import router as file_router
from .routes.status import router as status_router
from .routes.stage import router as stage_router
from .routes.commit import router as commit_router
from .routes.pushpull import router as pushpull_router
from .routes.search import router as search_router
from .routes.import_zip import router as import_zip_router
from .routes.shortcut import router as shortcut_router
from .routes.suggest_commit import router as suggest_commit_router
from .routes.offline_commit import router as offline_commit_router
from .routes.lfs import router as lfs_router
from .routes.keys import router as keys_router


app = FastAPI(title="PocketGit", version="1.0.0")

app.include_router(clone_router)
app.include_router(repos_router)
app.include_router(branch_router)
app.include_router(tree_router)
app.include_router(file_router)
app.include_router(status_router)
app.include_router(stage_router)
app.include_router(commit_router)
app.include_router(pushpull_router)
app.include_router(search_router)
app.include_router(import_zip_router)
app.include_router(shortcut_router)
app.include_router(suggest_commit_router)
app.include_router(offline_commit_router)
app.include_router(lfs_router)
app.include_router(keys_router)
