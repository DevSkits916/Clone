import { API_BASE_URL } from '../config.js';

const jsonHeaders = {
  'Content-Type': 'application/json'
};

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

export function getRepos() {
  return fetch(`${API_BASE_URL}/repos`).then(handleResponse);
}

export function cloneRepo(payload) {
  return fetch(`${API_BASE_URL}/clone`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  }).then(handleResponse);
}

export function getTree(repoId, path = '') {
  const encodedPath = encodeURIComponent(path);
  return fetch(`${API_BASE_URL}/repo/${repoId}/tree?path=${encodedPath}`).then(handleResponse);
}

export function getFile(repoId, path) {
  const encodedPath = encodeURIComponent(path);
  return fetch(`${API_BASE_URL}/repo/${repoId}/file?path=${encodedPath}`).then(handleResponse);
}

export function saveFile(repoId, path, content) {
  return fetch(`${API_BASE_URL}/repo/${repoId}/file`, {
    method: 'PUT',
    headers: jsonHeaders,
    body: JSON.stringify({ path, content })
  }).then(handleResponse);
}

export function getStatus(repoId) {
  return fetch(`${API_BASE_URL}/repo/${repoId}/status`).then(handleResponse);
}

export function getDiff(repoId) {
  return fetch(`${API_BASE_URL}/repo/${repoId}/diff`).then(handleResponse);
}

export function stageFile(repoId, path) {
  return fetch(`${API_BASE_URL}/repo/${repoId}/stage`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ path })
  }).then(handleResponse);
}

export function unstageFile(repoId, path) {
  return fetch(`${API_BASE_URL}/repo/${repoId}/unstage`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ path })
  }).then(handleResponse);
}

export function commit(repoId, payload) {
  return fetch(`${API_BASE_URL}/repo/${repoId}/commit`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  }).then(handleResponse);
}

export function push(repoId) {
  return fetch(`${API_BASE_URL}/repo/${repoId}/push`, {
    method: 'POST'
  }).then(handleResponse);
}

export function fetchRemote(repoId) {
  return fetch(`${API_BASE_URL}/repo/${repoId}/fetch`, {
    method: 'POST'
  }).then(handleResponse);
}

export function merge(repoId, payload) {
  return fetch(`${API_BASE_URL}/repo/${repoId}/merge`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  }).then(handleResponse);
}

export function getBranches(repoId) {
  return fetch(`${API_BASE_URL}/repo/${repoId}/branches`).then(handleResponse);
}

export function createBranch(repoId, payload) {
  return fetch(`${API_BASE_URL}/repo/${repoId}/branch/create`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  }).then(handleResponse);
}

export function switchBranch(repoId, payload) {
  return fetch(`${API_BASE_URL}/repo/${repoId}/branch/switch`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  }).then(handleResponse);
}

export function deleteBranch(repoId, payload) {
  return fetch(`${API_BASE_URL}/repo/${repoId}/branch`, {
    method: 'DELETE',
    headers: jsonHeaders,
    body: JSON.stringify(payload)
  }).then(handleResponse);
}

export function searchRepo(repoId, query) {
  const encoded = encodeURIComponent(query);
  return fetch(`${API_BASE_URL}/repo/${repoId}/search?q=${encoded}`).then(handleResponse);
}
