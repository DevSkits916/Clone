import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/layout.css';
import './styles/panels.css';
import './styles/diff.css';
import { API_BASE_URL } from './config.js';
import manifestUrl from './manifest.json?url';
import serviceWorkerUrl from './service-worker.js?url';

function ensureManifestLink() {
  const existing = document.querySelector('link[rel="manifest"]');
  if (existing) {
    existing.href = manifestUrl;
    return;
  }
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = manifestUrl;
  document.head.appendChild(link);
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register(serviceWorkerUrl);
    const postConfig = (worker) => {
      if (worker) {
        worker.postMessage({ type: 'CONFIG', apiBaseUrl: API_BASE_URL });
      }
    };
    if (registration.active) {
      postConfig(registration.active);
    }
    navigator.serviceWorker.ready.then((ready) => {
      postConfig(ready.active);
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const controller = navigator.serviceWorker.controller;
      if (controller) {
        postConfig(controller);
      }
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Service worker registration failed', error);
  }
}

ensureManifestLink();
registerServiceWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
