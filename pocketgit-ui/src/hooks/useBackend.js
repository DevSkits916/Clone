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
  registerBackgroundSync
} from '../utils/offlineStore.js';

const TOKEN_STORAGE_KEY = 'pocketgit:token';

let authToken = null;
try {
  if (typeof localStorage !== 'undefined') {
    authToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  }
} catch (error) {
  authToken = null;
}

const unauthorizedListeners = new Set();

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

export function getAuthToken() {
  return authToken;
}

export function setAuthToken(token) {
  authToken = token;
  try {
    if (typeof localStorage !== 'undefined') {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }
  } catch (error) {
    // Ignore storage errors in non-browser environments.
  }
}

export function clearAuthToken() {
  setAuthToken(null);
}

export function onUnauthorized(callback) {
  unauthorizedListeners.add(callback);
  return () => unauthorizedListeners.delete(callback);
}

function notifyUnauthorized() {
  clearAuthToken();
  unauthorizedListeners.forEach((handler) => {
    try {
      handler();
    } catch (error) {
      // swallow listener errors
    }
  });
}

async function request(path, options = {}) {
  const { skipAuth = false, rawResponse = false, ...rest } = options;
  const headers = new Headers(rest.headers || {});

  if (rest.body != null && !(rest.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (!skipAuth) {
    if (!authToken) {
      try {
        if (typeof localStorage !== 'undefined') {
          const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
          if (stored) {
            authToken = stored;
          }
        }
      } catch (error) {
        authToken = null;
      }
    }
    if (authToken) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }
  }

  rest.headers = headers;

  const response = await fetch(buildUrl(path), rest);
  if (response.status === 401) {
    notifyUnauthorized();
  }
  if (rawResponse) {
    return response;
  }
  return handleResponse(response);
}

export function getRepos() {
  return request('/repos');
}

export function cloneRepo(payload) {
  return request('/clone', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function importZip(formData) {
  return request('/import-zip', {
    method: 'POST',
    body: formData
  });
}

export function getTree(repoId, path = '') {
  const encodedPath = encodeURIComponent(path);
  return request(`/repo/${repoId}/tree?path=${encodedPath}`);
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
    const data = await request(`/repo/${repoId}/file?path=${encodedPath}`);
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
    const result = await request(`/repo/${repoId}/file`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
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
  return request(`/repo/${repoId}/status`);
}

export function getDiff(repoId) {
  return request(`/repo/${repoId}/diff`);
}

function toPathArray(input) {
  if (Array.isArray(input)) {
    return input;
  }
  if (input == null) {
    return [];
  }
  return [input];
}

export function stageFile(repoId, paths) {
  return request(`/repo/${repoId}/stage`, {
    method: 'POST',
    body: JSON.stringify({ paths: toPathArray(paths) })
  });
}

export function unstageFile(repoId, paths) {
  return request(`/repo/${repoId}/unstage`, {
    method: 'POST',
    body: JSON.stringify({ paths: toPathArray(paths) })
  });
}

export function commit(repoId, payload) {
  return request(`/repo/${repoId}/commit`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function suggestCommitMessage(repoId) {
  return request(`/repo/${repoId}/suggest-commit-message`, {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function push(repoId) {
  return request(`/repo/${repoId}/push`, { method: 'POST' });
}

export function fetchRemote(repoId) {
  return request(`/repo/${repoId}/fetch`, { method: 'POST' });
}

export function merge(repoId, payload) {
  return request(`/repo/${repoId}/merge`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getBranches(repoId) {
  return request(`/repo/${repoId}/branches`);
}

export function createBranch(repoId, payload) {
  return request(`/repo/${repoId}/branch/create`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function switchBranch(repoId, payload) {
  return request(`/repo/${repoId}/branch/switch`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteBranch(repoId, payload) {
  return request(`/repo/${repoId}/branch`, {
    method: 'DELETE',
    body: JSON.stringify(payload)
  });
}

export function searchRepo(repoId, query) {
  const encoded = encodeURIComponent(query);
  return request(`/repo/${repoId}/search?q=${encoded}`);
}

export function listSSHKeys() {
  return request('/keys/list');
}

export function uploadSSHKey(payload) {
  return request('/keys/upload', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteSSHKey(keyId) {
  return request(`/keys/${keyId}`, { method: 'DELETE' });
}

export function getLfsList(repoId) {
  return request(`/repo/${repoId}/lfs/list`);
}

export function fetchLfsFile(repoId, path) {
  const encoded = encodeURIComponent(path);
  return request(`/repo/${repoId}/lfs/fetch?path=${encoded}`);
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

export async function registerUser(credentials) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(credentials),
    skipAuth: true
  });
}

export async function loginUser(credentials) {
  const result = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
    skipAuth: true
  });
  if (!result || !result.token) {
    throw new Error('Authentication response did not include a token');
  }
  setAuthToken(result.token);
  return result;
}

export function logoutUser() {
  clearAuthToken();
}

export function listSecrets(repoId) {
  return request(`/repo/${repoId}/secrets`);
}

export function createSecret(repoId, payload) {
  return request(`/repo/${repoId}/secrets`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteSecret(repoId, payload) {
  return request(`/repo/${repoId}/secrets`, {
    method: 'DELETE',
    body: JSON.stringify(payload)
  });
}

export function getActivity(repoId) {
  return request(`/repo/${repoId}/activity`);
}

export { OFFLINE_EVENT };
