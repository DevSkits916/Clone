const STATIC_CACHE = 'pocketgit-static-v1';
const API_CACHE = 'pocketgit-api-v1';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/icon.svg'];
const DB_NAME = 'pocketgit-offline';
const STORE_NAME = 'repos';

let apiBaseUrl = 'http://localhost:8000';

function buildUrl(path) {
  const base = apiBaseUrl.replace(/\/$/, '');
  return `${base}${path}`;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (![STATIC_CACHE, API_CACHE].includes(key)) {
            return caches.delete(key);
          }
          return undefined;
        })
      )
    ).then(() => self.clients.claim())
  );
});

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) {
      return cached;
    }
    return fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
      return response;
    });
  });
}

function networkFirst(request) {
  return fetch(request)
    .then((response) => {
      const copy = response.clone();
      caches.open(API_CACHE).then((cache) => cache.put(request, copy));
      return response;
    })
    .catch(() => caches.match(request));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (STATIC_ASSETS.includes(url.pathname) || url.pathname.startsWith('/assets/')) {
      event.respondWith(cacheFirst(request));
      return;
    }
  }
  if (url.href.startsWith(apiBaseUrl.replace(/\/$/, ''))) {
    event.respondWith(networkFirst(request));
  }
});

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function collectReposWithPending(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const repos = [];
    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) {
        resolve(repos);
        return;
      }
      const record = cursor.value || {};
      const pending = Array.isArray(record.pendingCommits) ? record.pendingCommits : [];
      if (pending.length) {
        repos.push(cursor.key);
      }
      cursor.continue();
    };
    cursorRequest.onerror = () => reject(cursorRequest.error);
    tx.onerror = () => reject(tx.error);
  });
}

function readRepoRecord(db, repoId) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(repoId);
    request.onsuccess = () => {
      const record = request.result || { files: {}, pendingCommits: [] };
      record.files = record.files || {};
      record.pendingCommits = Array.isArray(record.pendingCommits) ? record.pendingCommits : [];
      resolve(record);
    };
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

function writeRepoRecord(db, repoId, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(record, repoId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dedupeChanges(pending) {
  const map = new Map();
  pending.forEach((entry) => {
    map.set(entry.path, entry.newContent);
  });
  return Array.from(map.entries()).map(([path, content]) => ({ path, content }));
}

async function commitChanges(repoId, changes, message) {
  const body = {
    changes,
    message: message || 'Offline edits sync',
  };
  const response = await fetch(buildUrl(`/repo/${repoId}/offline-commit`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}

async function putChangesIndividually(repoId, changes) {
  for (const change of changes) {
    const response = await fetch(buildUrl(`/repo/${repoId}/file`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: change.path, content: change.content }),
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
  }
}

async function flushRepo(repoId, message) {
  const db = await openDatabase();
  try {
    const record = await readRepoRecord(db, repoId);
    const pending = record.pendingCommits;
    if (!pending.length) {
      return false;
    }
    const changes = dedupeChanges(pending);
    try {
      await commitChanges(repoId, changes, message);
    } catch (error) {
      await putChangesIndividually(repoId, changes);
    }
    record.pendingCommits = [];
    await writeRepoRecord(db, repoId, record);
    return true;
  } finally {
    db.close();
  }
}

async function flushAllPending(message = 'Auto-sync from background') {
  const db = await openDatabase();
  let repoIds = [];
  try {
    repoIds = await collectReposWithPending(db);
  } finally {
    db.close();
  }
  for (const repoId of repoIds) {
    try {
      await flushRepo(repoId, message);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Failed to sync offline edits for', repoId, error);
    }
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'pocketgit-sync') {
    event.waitUntil(flushAllPending('Auto-sync from background'));
  }
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'CONFIG' && data.apiBaseUrl) {
    apiBaseUrl = data.apiBaseUrl;
  }
  if (data.type === 'TRIGGER_SYNC') {
    event.waitUntil(flushAllPending('Auto-sync from background'));
  }
});
