import React, { useState } from 'react';
import { searchRepo } from '../hooks/useBackend.js';

export default function SearchPanel({ activeRepoId, onOpenFile }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!activeRepoId || !query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchRepo(activeRepoId, query.trim());
      const normalized = Array.isArray(data) ? data : [];
      setResults(normalized);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!activeRepoId) {
    return (
      <div className="panel search-panel">
        <p>Select a repository to search.</p>
      </div>
    );
  }

  return (
    <div className="panel search-panel">
      <div className="panel-header">
        <h2>Search</h2>
      </div>
      <form className="search-form" onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search term"
          required
        />
        <button type="submit">Search</button>
      </form>
      {loading && <p>Searching…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && results.length === 0 && !error && <p className="muted">No results yet.</p>}
      <ul className="search-results">
        {results.map((item, index) => {
          const path = item.path || item.file || '';
          const line = item.line ?? item.lineNumber ?? item.lineno ?? '';
          const preview = item.preview || item.snippet || '';
          if (!path) return null;
          return (
            <li key={`${path}-${line}-${index}`}>
              <button
                className="search-result"
                onClick={() => onOpenFile && onOpenFile(path)}
              >
                <span className="result-path">{path}{line ? `:${line}` : ''}</span>
                <span className="result-snippet">{preview}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
