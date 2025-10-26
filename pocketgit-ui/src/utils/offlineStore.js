import { openDB } from 'idb';
import { API_BASE_URL } from '../config.js';

const DB_NAME = 'pocketgit-offline';
const DB_VERSION = 1;
const STORE_NAME = 'repos';
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const MAX_PENDING = 500;

export const OFFLINE_EVENT = 'pocketgit:offline-updated';

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME);
    }
  }
});

function getEventTarget() {
  if (typeof window !== 'undefined') {
    return window;
  }
  return undefined;
}

function emitUpdate(repoId) {
  const target = getEventTarget();
  if (target && typeof target.dispatchEvent === 'function') {
    target.dispatchEvent(new CustomEvent(OFFLINE_EVENT, { detail: { repoId } }));
  }
}

async function readRepoRecord(repoId) {
  const db = await dbPromise;
  const record = await db.get(STORE_NAME, repoId);
  if (record) {
    record.files = record.files || {};
    record.pendingCommits = Array.isArray(record.pendingCommits) ? record.pendingCommits : [];
    return record;
  }
  return { files: {}, pendingCommits: [] };
}

async function writeRepoRecord(repoId, record) {
  const db = await dbPromise;
  await db.put(STORE_NAME, record, repoId);
  emitUpdate(repoId);
}

function buildUrl(path) {
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

export async function cacheFile(repoId, path, content) {
  const record = await readRepoRecord(repoId);
  record.files[path] = content ?? '';
  await writeRepoRecord(repoId, record);
}

export async function getCachedFile(repoId, path) {
  const record = await readRepoRecord(repoId);
  return record.files[path] ?? null;
}

export async function recordPendingChange(repoId, path, newContent) {
  const record = await readRepoRecord(repoId);
  const timestamp = Date.now();
  record.pendingCommits.push({ path, newContent, timestamp });
  if (record.pendingCommits.length > MAX_PENDING) {
    record.pendingCommits = record.pendingCommits.slice(-MAX_PENDING);
  }
  record.files[path] = newContent;
  await writeRepoRecord(repoId, record);
}

export async function getPendingChanges(repoId) {
  const record = await readRepoRecord(repoId);
  return [...record.pendingCommits];
}

export async function hasPendingChanges(repoId) {
  const record = await readRepoRecord(repoId);
  return record.pendingCommits.length > 0;
}

async function ensureOnline() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Cannot sync offline edits while offline.');
  }
}

function dedupePendingChanges(pending) {
  const latest = new Map();
  for (const entry of pending) {
    latest.set(entry.path, entry.newContent);
  }
  return Array.from(latest.entries()).map(([path, content]) => ({ path, content }));
}

async function commitChanges(repoId, changes, options) {
  const body = {
    changes,
    message: options.commitMessage || options.message || 'Offline edits sync',
    authorName: options.authorName,
    authorEmail: options.authorEmail
  };
  const response = await fetch(buildUrl(`/repo/${repoId}/offline-commit`), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Failed to commit offline edits');
  }
  return true;
}

async function putChangesIndividually(repoId, changes) {
  for (const change of changes) {
    const response = await fetch(buildUrl(`/repo/${repoId}/file`), {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ path: change.path, content: change.content })
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Failed to sync ${change.path}`);
    }
  }
}

export async function flushPendingChanges(repoId, options = {}) {
  await ensureOnline();
  const record = await readRepoRecord(repoId);
  if (!record.pendingCommits.length) {
    return { ok: true, synced: false };
  }

  const changes = dedupePendingChanges(record.pendingCommits);
  let committed = false;
  try {
    committed = await commitChanges(repoId, changes, options);
  } catch (error) {
    await putChangesIndividually(repoId, changes);
  }

  record.pendingCommits = [];
  await writeRepoRecord(repoId, record);
  return { ok: true, synced: true, committed };
}

export async function flushAllPendingChanges(options = {}) {
  const repoIds = await getReposWithPendingChanges();
  const results = [];
  for (const repoId of repoIds) {
    try {
      const result = await flushPendingChanges(repoId, options);
      results.push({ repoId, result });
    } catch (error) {
      results.push({ repoId, error });
    }
  }
  return results;
}

export async function getReposWithPendingChanges() {
  const db = await dbPromise;
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.store;
  const keys = await store.getAllKeys();
  const repos = [];
  for (const key of keys) {
    const record = await store.get(key);
    if (record?.pendingCommits?.length) {
      repos.push(key);
    }
  }
  await tx.done;
  return repos;
}

export async function registerBackgroundSync() {
  if (typeof navigator === 'undefined') {
    return;
  }
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    return;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('pocketgit-sync');
  } catch (error) {
    // ignore background sync errors silently
  }
}
