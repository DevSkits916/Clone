import React, { useEffect, useState } from 'react';
import { createSecret, deleteSecret, listSecrets } from '../hooks/useBackend.js';

export default function SecretsPanel({ repoId }) {
  const [secrets, setSecrets] = useState([]);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!repoId) {
      setSecrets([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listSecrets(repoId)
      .then((data) => {
        if (!cancelled) {
          setSecrets(Array.isArray(data?.secrets) ? data.secrets : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [repoId]);

  const refresh = async () => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listSecrets(repoId);
      setSecrets(Array.isArray(data?.secrets) ? data.secrets : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (event) => {
    event.preventDefault();
    if (!repoId) return;
    if (!name.trim()) {
      setError('Secret name is required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await createSecret(repoId, { name: name.trim(), value });
      setName('');
      setValue('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (secretName) => {
    if (!repoId) return;
    setLoading(true);
    setError(null);
    try {
      await deleteSecret(repoId, { name: secretName });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!repoId) {
    return (
      <div className="panel-section secrets-panel">
        <p className="muted">Select a repository to manage secrets.</p>
      </div>
    );
  }

  return (
    <div className="panel-section secrets-panel">
      <div className="panel-header">
        <h3>Repository Secrets</h3>
        <button type="button" className="secondary" onClick={refresh} disabled={loading}>
          Refresh
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
      {loading && <p className="muted">Loading secrets…</p>}
      {secrets.length === 0 && !loading && <p className="muted">No secrets have been stored yet.</p>}
      {secrets.length > 0 && (
        <ul className="secrets-list">
          {secrets.map((secret) => (
            <li key={secret.name}>
              <div className="secret-info">
                <span className="secret-name">{secret.name}</span>
                <span className="secret-value">{secret.value}</span>
              </div>
              <button type="button" className="danger" onClick={() => handleDelete(secret.name)} disabled={loading}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="secret-form" onSubmit={handleAdd}>
        <div className="secret-fields">
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} disabled={loading} required />
          </label>
          <label>
            <span>Value</span>
            <input value={value} onChange={(event) => setValue(event.target.value)} disabled={loading} required />
          </label>
        </div>
        <button type="submit" disabled={loading}>
          Add Secret
        </button>
      </form>
    </div>
  );
}
