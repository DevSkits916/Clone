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
