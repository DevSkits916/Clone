import React, { useEffect, useState } from 'react';
import { deleteSSHKey, listSSHKeys, uploadSSHKey } from '../hooks/useBackend.js';

const KEY_EVENT = 'pocketgit:ssh-keys-updated';

function notifyKeysUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(KEY_EVENT));
  }
}

function formatDate(value) {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  } catch (error) {
    return value;
  }
}

export default function SSHKeysPanel({ isOnline }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [formState, setFormState] = useState({ name: '', privateKey: '' });

  const loadKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listSSHKeys();
      const list = Array.isArray(response?.keys) ? response.keys : [];
      setKeys(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!formState.privateKey.trim()) {
      setError('Paste a private key in PEM format.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await uploadSSHKey({ name: formState.name || undefined, privateKey: formState.privateKey });
      setFormState({ name: '', privateKey: '' });
      await loadKeys();
      notifyKeysUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (keyId) => {
    setDeletingId(keyId);
    setError(null);
    try {
      await deleteSSHKey(keyId);
      await loadKeys();
      notifyKeysUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="panel ssh-keys-panel">
      <div className="panel-header">
        <h2>SSH Keys</h2>
      </div>
      {!isOnline && (
        <p className="muted">Connect to the internet to upload or delete keys.</p>
      )}
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>Loading keys…</p>
      ) : keys.length === 0 ? (
        <p>No SSH keys uploaded yet.</p>
      ) : (
        <ul className="ssh-key-list">
          {keys.map((key) => (
            <li key={key.id} className="ssh-key-item">
              <div className="ssh-key-meta">
                <strong>{key.name || 'Unnamed key'}</strong>
                <span className="ssh-key-created">Added {formatDate(key.createdAt)}</span>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(key.id)}
                disabled={!isOnline || deletingId === key.id}
                className="danger"
              >
                {deletingId === key.id ? 'Deleting…' : 'Delete'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="ssh-key-form" onSubmit={handleUpload}>
        <label>
          Name (optional)
          <input
            type="text"
            name="name"
            value={formState.name}
            onChange={handleChange}
            placeholder="Production deploy key"
            disabled={!isOnline || uploading}
          />
        </label>
        <label>
          Private key (PEM)
          <textarea
            name="privateKey"
            rows={6}
            value={formState.privateKey}
            onChange={handleChange}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            disabled={!isOnline || uploading}
          />
        </label>
        <button type="submit" disabled={!isOnline || uploading}>
          {uploading ? 'Uploading…' : 'Upload key'}
        </button>
      </form>
    </div>
  );
}
