# PocketGit Workspace

This repository groups the PocketGit backend service together with its companion single-page application. Use it to run a self-hosted Git workspace that exposes a REST API and an authenticated web UI for cloning repositories, editing files, and managing pushes from any browser.

## Project layout

| Path | Description |
| --- | --- |
| `pocketgit/` | FastAPI backend that wraps a local Git workspace and exposes authentication, repository management, staging, commit, push/pull, LFS, SSH key, and encrypted secret endpoints. |
| `pocketgit-ui/` | React + Vite frontend that consumes the backend API to provide a responsive Git client in the browser, including offline editing, activity feeds, PWA install, and automation helpers. |

## Getting started locally

### 1. Launch the backend

```bash
cd pocketgit
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The FastAPI server defaults to `http://127.0.0.1:8000`. Override secrets such as `POCKETGIT_JWT_SECRET` or `POCKETGIT_SECRET_KEY` in your environment when you need custom signing or encryption keys.

### 2. Start the frontend

```bash
cd pocketgit-ui
npm install
npm run dev
```

By default Vite serves the UI at `http://127.0.0.1:5173`. Update `src/config.js` if you run the backend on a different host or port.

### 3. Sign in

Create an account via `POST /auth/register` on the backend or reuse an existing entry in `pocketgit/auth/users.json`. Log in through the UI or `POST /auth/login` to obtain a JWT; provide it in the UI when prompted or via the `Authorization: Bearer <token>` header for API calls.

## Deployment notes

- The backend ships with a `render.yaml` and `Dockerfile` for deploying to Render or any container host.
- The frontend builds to static assets with `npm run build`; serve the generated `dist/` directory on any static host and point `API_BASE_URL` at your backend.

## Contributing

1. Create a feature branch.
2. Make your changes and add tests where relevant.
3. Run formatting and test suites for the backend (`pytest` or targeted scripts) and frontend (`npm test` if added) before submitting pull requests.

Happy hacking!
