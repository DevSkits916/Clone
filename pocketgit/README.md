# PocketGit

PocketGit is a lightweight FastAPI backend that exposes a simple Git workspace over HTTP. It is designed for a trusted single-user environment and is deployable on Render's free tier.

## Features

- Clone repositories from any Git remote.
- List repositories and inspect ahead/behind status.
- Browse directories and read/write files.
- Stage, unstage, and commit changes.
- Push, fetch, merge, and rebase.
- Manage branches.
- Search across tracked files.

> **Important:** PocketGit has **no authentication**. Do not expose it publicly without additional protection.

## Project Structure

```
pocketgit/
├── app/
│   ├── main.py
│   ├── models/
│   │   ├── request_schemas.py
│   │   └── response_schemas.py
│   ├── routes/
│   │   ├── branch.py
│   │   ├── clone.py
│   │   ├── commit.py
│   │   ├── file.py
│   │   ├── pushpull.py
│   │   ├── repos.py
│   │   ├── search.py
│   │   ├── stage.py
│   │   ├── status.py
│   │   └── tree.py
│   ├── services/
│   │   ├── git_repo.py
│   │   └── repo_manager.py
│   └── utils/
│       ├── diff_utils.py
│       └── fs_utils.py
├── repos/
├── requirements.txt
├── Dockerfile
├── render.yaml
└── README.md
```

## Running Locally

1. **Create a virtual environment**

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

3. **Start the development server**

   ```bash
   uvicorn app.main:app --reload
   ```

   The API will be available at `http://127.0.0.1:8000`.

## API Reference (curl examples)

Replace `<REPO_ID>` with the identifier returned from `/clone`.

### 1. Clone a repository

```bash
curl -X POST http://127.0.0.1:8000/clone \
  -H "Content-Type: application/json" \
  -d '{
        "url": "https://github.com/owner/project.git",
        "branch": "main"
      }'
```

### 2. List repositories

```bash
curl http://127.0.0.1:8000/repos
```

### 3. List branches

```bash
curl http://127.0.0.1:8000/repo/<REPO_ID>/branches
```

### 4. Create a branch

```bash
curl -X POST http://127.0.0.1:8000/repo/<REPO_ID>/branch/create \
  -H "Content-Type: application/json" \
  -d '{"name": "feature-x", "from": "main"}'
```

### 5. Switch branches

```bash
curl -X POST http://127.0.0.1:8000/repo/<REPO_ID>/branch/switch \
  -H "Content-Type: application/json" \
  -d '{"name": "feature-x"}'
```

### 6. Delete a branch

```bash
curl -X DELETE http://127.0.0.1:8000/repo/<REPO_ID>/branch \
  -H "Content-Type: application/json" \
  -d '{"name": "feature-x"}'
```

### 7. Browse a directory tree

```bash
curl "http://127.0.0.1:8000/repo/<REPO_ID>/tree?path=src"
```

### 8. Read a file

```bash
curl "http://127.0.0.1:8000/repo/<REPO_ID>/file?path=README.md"
```

### 9. Write a file

```bash
curl -X PUT http://127.0.0.1:8000/repo/<REPO_ID>/file \
  -H "Content-Type: application/json" \
  -d '{"path": "src/app.py", "content": "print(\"Hello\")"}'
```

### 10. Repository status

```bash
curl http://127.0.0.1:8000/repo/<REPO_ID>/status
```

### 11. Unified diff

```bash
curl http://127.0.0.1:8000/repo/<REPO_ID>/diff
```

### 12. Stage files

```bash
curl -X POST http://127.0.0.1:8000/repo/<REPO_ID>/stage \
  -H "Content-Type: application/json" \
  -d '{"paths": ["src/app.py"]}'
```

### 13. Unstage files

```bash
curl -X POST http://127.0.0.1:8000/repo/<REPO_ID>/unstage \
  -H "Content-Type: application/json" \
  -d '{"paths": ["src/app.py"]}'
```

### 14. Commit changes

```bash
curl -X POST http://127.0.0.1:8000/repo/<REPO_ID>/commit \
  -H "Content-Type: application/json" \
  -d '{
        "message": "Fix bug",
        "authorName": "Jane Doe",
        "authorEmail": "jane@example.com"
      }'
```

### 15. Push changes

```bash
curl -X POST http://127.0.0.1:8000/repo/<REPO_ID>/push
```

### 16. Fetch latest from remote

```bash
curl -X POST http://127.0.0.1:8000/repo/<REPO_ID>/fetch
```

### 17. Merge or rebase

```bash
curl -X POST http://127.0.0.1:8000/repo/<REPO_ID>/merge \
  -H "Content-Type: application/json" \
  -d '{"fromBranch": "origin/main", "strategy": "merge"}'
```

### 18. Search tracked files

```bash
curl "http://127.0.0.1:8000/repo/<REPO_ID>/search?q=TODO"
```

### 19. Import a zipped project folder

```bash
curl -X POST http://127.0.0.1:8000/import-zip \
  -F "repoName=My Project" \
  -F "file=@/path/to/folder.zip"
```

### 20. Suggest a commit message from staged changes

```bash
curl -X POST http://127.0.0.1:8000/repo/<REPO_ID>/suggest-commit-message
```

## Shortcut / automation endpoints (no auth, single-user only)

These helper endpoints allow iOS Shortcuts or other simple automations to trigger git actions with a GET request.

```bash
# Push the current branch
curl "http://127.0.0.1:8000/shortcut/push?repoId=<REPO_ID>"

# Stage everything, commit, and push
curl "http://127.0.0.1:8000/shortcut/commit-and-push?repoId=<REPO_ID>&msg=Quick%20sync&name=Jane%20Doe&email=jane%40example.com"

# Fetch from the remote
curl "http://127.0.0.1:8000/shortcut/fetch?repoId=<REPO_ID>"
```

## Deploying on Render

1. Push this repository to your own GitHub repository.
2. In Render, create a **new Web Service** and select the repository.
3. Render will detect `render.yaml` and configure the service automatically. Ensure the service is on the free plan.
4. Deploy. Render will build the Docker image using the provided Dockerfile and start the FastAPI server on port 8000.

## Notes

- All repositories are stored in `./repos/<repoId>/` relative to the project root.
- Each cloned repository stores metadata in `pocketgit.json` within the repo folder.
- This service does not implement authentication or authorization. Use it only in controlled environments.
