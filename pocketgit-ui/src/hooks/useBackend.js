import { API_BASE_URL } from '../config.js';
import {
  OFFLINE_EVENT,
  cacheFile,
  flushAllPendingChanges,
  flushPendingChanges,
  getCachedFile,
  getPendingChanges,
  getReposWithPendingChanges,
  hasPendingChanges,
  recordPendingChange,
  registerBackgroundSync,
} from '../utils/offlineStore.js';

const jsonHeaders = {
  'Content-Type': 'application/json'
};

function isNavigatorOnline() {
  if (typeof navigator === 'undefined') {
    return true;
  }
  return navigator.onLine;
}

async function handleResponse(response) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

function buildUrl(path) {
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

export function getRepos() {
  return fetch(buildUrl('/repos')).then(handleResponse);
}

export function cloneRepo(payload) {
  return fetch(buildUrl('/clone'), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  }).then(handleResponse);
}

export function importZip(formData) {
  return fetch(buildUrl('/import-zip'), {
    method: 'POST',
    body: formData
  }).then(handleResponse);
}

export function getTree(repoId, path = '') {
  const encodedPath = encodeURIComponent(path);
  return fetch(buildUrl(`/repo/${repoId}/tree?path=${encodedPath}`)).then(handleResponse);
}

export async function getFile(repoId, path) {
  if (!repoId || !path) {
    throw new Error('Missing repository or path');
  }
  if (!isNavigatorOnline()) {
    const cached = await getCachedFile(repoId, path);
    if (cached == null) {
      throw new Error('File is not available offline yet. Connect to the network to fetch it once.');
    }
    return { path, content: cached, offline: true };
  }

  const encodedPath = encodeURIComponent(path);
  try {
    const response = await fetch(buildUrl(`/repo/${repoId}/file?path=${encodedPath}`));
    const data = await handleResponse(response);
    const content = typeof data === 'string' ? data : data?.content ?? '';
    await cacheFile(repoId, path, content);
    return data;
  } catch (error) {
    const cached = await getCachedFile(repoId, path);
    if (cached != null) {
      return { path, content: cached, offline: true };
    }
    throw error;
  }
}

export async function saveFile(repoId, path, content) {
  if (!repoId || !path) {
    throw new Error('Missing repository or path');
  }
  const payload = { path, content };
  if (!isNavigatorOnline()) {
    await cacheFile(repoId, path, content);
    await recordPendingChange(repoId, path, content);
    await registerBackgroundSync();
    return { ok: true, offline: true };
  }

  try {
    const response = await fetch(buildUrl(`/repo/${repoId}/file`), {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(payload)
    });
    const result = await handleResponse(response);
    await cacheFile(repoId, path, content);
    return result;
  } catch (error) {
    await cacheFile(repoId, path, content);
    await recordPendingChange(repoId, path, content);
    await registerBackgroundSync();
    return { ok: true, offline: true, error };
  }
}

export function getStatus(repoId) {
  return fetch(buildUrl(`/repo/${repoId}/status`)).then(handleResponse);
}

export function getDiff(repoId) {
  return fetch(buildUrl(`/repo/${repoId}/diff`)).then(handleResponse);
}

export function stageFile(repoId, path) {
  return fetch(buildUrl(`/repo/${repoId}/stage`), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ path })
  }).then(handleResponse);
}

export function unstageFile(repoId, path) {
  return fetch(buildUrl(`/repo/${repoId}/unstage`), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ path })
  }).then(handleResponse);
}

export function commit(repoId, payload) {
  return fetch(buildUrl(`/repo/${repoId}/commit`), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  }).then(handleResponse);
}

export function suggestCommitMessage(repoId) {
  return fetch(buildUrl(`/repo/${repoId}/suggest-commit-message`), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({})
  }).then(handleResponse);
}

export function push(repoId) {
  return fetch(buildUrl(`/repo/${repoId}/push`), {
    method: 'POST'
  }).then(handleResponse);
}

export function fetchRemote(repoId) {
  return fetch(buildUrl(`/repo/${repoId}/fetch`), {
    method: 'POST'
  }).then(handleResponse);
}

export function merge(repoId, payload) {
  return fetch(buildUrl(`/repo/${repoId}/merge`), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  }).then(handleResponse);
}

export function getBranches(repoId) {
  return fetch(buildUrl(`/repo/${repoId}/branches`)).then(handleResponse);
}

export function createBranch(repoId, payload) {
  return fetch(buildUrl(`/repo/${repoId}/branch/create`), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  }).then(handleResponse);
}

export function switchBranch(repoId, payload) {
  return fetch(buildUrl(`/repo/${repoId}/branch/switch`), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  }).then(handleResponse);
}

export function deleteBranch(repoId, payload) {
  return fetch(buildUrl(`/repo/${repoId}/branch`), {
    method: 'DELETE',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  }).then(handleResponse);
}

export function searchRepo(repoId, query) {
  const encoded = encodeURIComponent(query);
  return fetch(buildUrl(`/repo/${repoId}/search?q=${encoded}`)).then(handleResponse);
}

export function listSSHKeys() {
  return fetch(buildUrl('/keys/list')).then(handleResponse);
}

export function uploadSSHKey(payload) {
  return fetch(buildUrl('/keys/upload'), {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  }).then(handleResponse);
}

export function deleteSSHKey(keyId) {
  return fetch(buildUrl(`/keys/${keyId}`), {
    method: 'DELETE'
  }).then(handleResponse);
}

export function getLfsList(repoId) {
  return fetch(buildUrl(`/repo/${repoId}/lfs/list`)).then(handleResponse);
}

export function fetchLfsFile(repoId, path) {
  const encoded = encodeURIComponent(path);
  return fetch(buildUrl(`/repo/${repoId}/lfs/fetch?path=${encoded}`)).then(handleResponse);
}

export function syncOfflineChanges(repoId, options = {}) {
  return flushPendingChanges(repoId, options);
}

export function hasOfflineChanges(repoId) {
  return hasPendingChanges(repoId);
}

export function getOfflineChanges(repoId) {
  return getPendingChanges(repoId);
}

export function syncAllOfflineChanges(options = {}) {
  return flushAllPendingChanges(options);
}

export function getReposWithOfflineChanges() {
  return getReposWithPendingChanges();
}

export { OFFLINE_EVENT };
