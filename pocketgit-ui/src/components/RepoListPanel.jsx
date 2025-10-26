import React, { useEffect, useState } from 'react';
import { cloneRepo, getRepos, importZip } from '../hooks/useBackend.js';
import ModalCloneRepo from './ModalCloneRepo.jsx';
import ModalImportZip from './ModalImportZip.jsx';

export default function RepoListPanel({ activeRepoId, onSelectRepo }) {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [isCloning, setIsCloning] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importError, setImportError] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  const loadRepos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRepos();
      const list = Array.isArray(data) ? data : [];
      setRepos(list);
      if (!activeRepoId && list.length > 0) {
        const first = list[0];
        const repoId = first.id || first.repoId || first.name;
        if (repoId) {
          onSelectRepo(repoId);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRepos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClone = async (payload) => {
    setIsCloning(true);
    setModalError(null);
    try {
      const result = await cloneRepo(payload);
      await loadRepos();
      const newRepoId = result?.id || result?.repoId || result?.name || payload.url;
      if (newRepoId) {
        onSelectRepo(newRepoId);
      }
      setIsModalOpen(false);
      setModalError(null);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setIsCloning(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalError(null);
  };

  const handleImport = async (formData) => {
    setIsImporting(true);
    setImportError(null);
    try {
      const result = await importZip(formData);
      await loadRepos();
      const newRepoId = result?.repoId || result?.id || result?.name;
      if (newRepoId) {
        onSelectRepo(newRepoId);
      }
      setIsImportModalOpen(false);
      setImportError(null);
    } catch (err) {
      setImportError(err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCloseImportModal = () => {
    setIsImportModalOpen(false);
    setImportError(null);
  };

  return (
    <div className="panel repo-list">
      <div className="panel-header">
        <h2>Repositories</h2>
        <div className="panel-actions">
          <button onClick={() => { setIsImportModalOpen(true); setImportError(null); }}>Import .zip</button>
          <button onClick={() => { setIsModalOpen(true); setModalError(null); }}>Clone new repo</button>
        </div>
      </div>
      {loading && <p>Loading repositories…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && repos.length === 0 && <p>No repositories found.</p>}
      <div className="repo-buttons">
        {repos.map((repo) => {
          const repoId = repo.id || repo.repoId || repo.name;
          const branchLabel = repo.currentBranch || repo.branch || '—';
          return (
            <button
              key={repoId || repo.url}
              className={repoId === activeRepoId ? 'repo-button active' : 'repo-button'}
              onClick={() => repoId && onSelectRepo(repoId)}
              disabled={!repoId}
            >
              <span className="repo-name">{repo.name || repoId || repo.url}</span>
              <span className="repo-branch">{branchLabel}</span>
              <span className="repo-ahead">↑ {repo.ahead ?? 0}</span>
              <span className="repo-behind">↓ {repo.behind ?? 0}</span>
            </button>
          );
        })}
      </div>
      <ModalCloneRepo
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleClone}
        isLoading={isCloning}
        error={modalError}
      />
      <ModalImportZip
        isOpen={isImportModalOpen}
        onClose={handleCloseImportModal}
        onSubmit={handleImport}
        isLoading={isImporting}
        error={importError}
      />
    </div>
  );
}
