# pocketgit-ui

A responsive web UI for managing Git repositories through the `pocketgit` FastAPI backend.

## Prerequisites

- Node.js 18+
- npm 9+

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the development server:

   ```bash
   npm run dev
   ```

   The app runs at `http://localhost:5173` by default.

## Configure Backend API

All backend requests use the `API_BASE_URL` defined in `src/config.js`. Update that constant to point to your deployed `pocketgit` backend when necessary.

```js
export const API_BASE_URL = "http://localhost:8000";
```

## Import projects from a ZIP archive

From the **Repositories** panel, click **Import .zip** to upload a zipped folder. Provide an optional display name and PocketGit will unpack the archive, initialise a Git repository (if needed), and select it automatically once the import finishes.

## Automation URL helpers

The Git panel surfaces ready-to-copy URLs for the new shortcut endpoints:

- Push the current branch
- Stage everything, commit with a message, and push (fill in your own commit message)
- Fetch from the remote

Copy these URLs into iOS Shortcuts or any HTTP automation tool to trigger Git actions without opening the UI.

## Offline caching and sync

The UI caches files in IndexedDB as soon as you open them. When the connection drops the **Offline Mode** banner appears and the editor loads cached content. Saving while offline stores your changes locally and queues them for `/offline-commit` once the network returns. You can trigger the queue manually from the Git panel via **Sync Offline Changes**. The banner reports pending repositories and offers a one-click retry when you are back online.

Background sync is also enabled: if the browser supports the Sync API, the service worker flushes the queue automatically with the commit message _"Auto-sync from background"_.

## Git LFS downloads

Files tracked by Git LFS are marked with a 📦 icon and an **LFS** tag in the file tree. Clicking an LFS entry downloads the binary via `/repo/<repoId>/lfs/fetch` and saves it locally using the browser's download manager.

## SSH key management

Use the **SSH Keys** panel to upload, list, and delete deploy keys. Keys are stored securely on the backend with `chmod 600`. When cloning a repository you can choose a stored key from the **SSH key (optional)** selector in the Clone modal. This enables passwordless operations against `git@` style remotes.

## Install as a PWA

The project ships with a web app manifest and service worker. To install it:

- **iPhone / iPad:** open the site in Safari, tap the Share icon, then choose **Add to Home Screen**.
- **Desktop (Chromium/Edge):** open the site and use the install prompt in the address bar or via the browser menu.

Once installed, the app runs full-screen, caches core assets, and continues to sync offline edits in the background when the browser grants background sync permissions.

## Commit message suggestions

When staged changes are present, press **Suggest** next to the commit message box to request an automatic summary from the backend. The suggestion will populate the textarea if it was empty and also appears below the field for reference.

## HTML preview console enhancements

In preview mode for HTML files, the embedded sandbox now mirrors console output from the iframe. The console panel lists logs, warnings, errors, evaluation results, and provides a **Clear** button. Use the input box beneath it to run custom JavaScript within the previewed document.

## Build for Production

Create a production build that outputs a static site to `dist/`:

```bash
npm run build
```

Deploy the contents of the `dist/` directory to any static web host (Netlify, Vercel, GitHub Pages, Nginx, etc.). The application is 100% client-side and communicates with the `pocketgit` backend via the configured API base URL.

To locally preview the production build:

```bash
npm run preview
```

## Static Hosting

Upload the generated `dist/` directory to your preferred static hosting provider. Ensure the host serves `index.html` for all routes (single-page application). The frontend will interact with the backend API over HTTPS when hosted in production.
