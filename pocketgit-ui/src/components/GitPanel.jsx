import React, { useEffect, useState } from 'react';
import {
  commit,
  createBranch,
  deleteBranch,
  fetchRemote,
  getBranches,
  getDiff,
  getStatus,
  hasOfflineChanges as checkOfflineChanges,
  merge,
  push,
  suggestCommitMessage,
  syncOfflineChanges,
  stageFile,
  switchBranch,
  unstageFile
} from '../hooks/useBackend.js';
import { API_BASE_URL } from '../config.js';
import SecretsPanel from './SecretsPanel.jsx';
import ActivityPanel from './ActivityPanel.jsx';

function normalizeBranches(data) {
  if (!Array.isArray(data)) return [];
  return data
    .map((branch) => {
      if (typeof branch === 'string') return branch;
      if (branch && typeof branch === 'object') return branch.name || branch.ref || branch.id || '';
      return '';
    })
    .filter(Boolean);
}

export default function GitPanel({ activeRepoId, onOpenFile, offlineQueued = false, onOfflineSync }) {
  const [status, setStatus] = useState(null);
  const [diffText, setDiffText] = useState('');
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchFrom, setNewBranchFrom] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [mergeFrom, setMergeFrom] = useState('');
  const [mergeStrategy, setMergeStrategy] = useState('merge');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState(null);
  const [lastSuggestion, setLastSuggestion] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [offlinePending, setOfflinePending] = useState(offlineQueued);
  const [offlineSyncing, setOfflineSyncing] = useState(false);
  const [activeSection, setActiveSection] = useState('git');
  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
  const gitTabs = [
    { key: 'git', label: 'Git' },
    { key: 'secrets', label: 'Secrets' },
    { key: 'activity', label: 'Activity' }
  ];

  const loadAll = async () => {
    if (!activeRepoId) {
      setStatus(null);
      setDiffText('');
      setBranches([]);
      return;
    }
    try {
      const [statusData, diffData, branchData] = await Promise.all([
        getStatus(activeRepoId),
        getDiff(activeRepoId),
        getBranches(activeRepoId)
      ]);
      const branchNames = normalizeBranches(branchData);
      setStatus(statusData);
      setDiffText(diffData?.diff ?? '');
      setBranches(branchNames);
      setSelectedBranch(statusData?.branch || branchNames[0] || '');
      setNewBranchFrom(statusData?.branch || branchNames[0] || '');
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    setError(null);
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRepoId]);

  useEffect(() => {
    setActiveSection('git');
  }, [activeRepoId]);

  useEffect(() => {
    setLastSuggestion('');
    setCommitMessage('');
    setSuggesting(false);
    setOfflinePending(offlineQueued);
  }, [activeRepoId, offlineQueued]);

  useEffect(() => {
    if (!activeRepoId) {
      setOfflinePending(false);
      return;
    }
    let cancelled = false;
    checkOfflineChanges(activeRepoId)
      .then((pending) => {
        if (!cancelled) {
          setOfflinePending(Boolean(pending));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOfflinePending(Boolean(offlineQueued));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeRepoId, offlineQueued]);

  const runAction = async (fn, message) => {
    setLoadingMessage(message);
    setError(null);
    try {
      await fn();
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMessage('');
    }
  };

  if (!activeRepoId) {
    return (
      <div className="panel git-panel">
        <p>Select a repository to view Git status.</p>
      </div>
    );
  }

  const handleStage = (path) => runAction(() => stageFile(activeRepoId, path), 'Staging…');
  const handleUnstage = (path) => runAction(() => unstageFile(activeRepoId, path), 'Unstaging…');
  const handleCommit = () => runAction(async () => {
    await commit(activeRepoId, { message: commitMessage, authorName, authorEmail });
    setCommitMessage('');
  }, 'Committing…');
  const handlePush = () => runAction(() => push(activeRepoId), 'Pushing…');
  const handleFetch = () => runAction(() => fetchRemote(activeRepoId), 'Fetching…');
  const handleSwitchBranch = () => runAction(() => switchBranch(activeRepoId, { name: selectedBranch }), 'Switching branch…');
  const handleCreateBranch = () => runAction(async () => {
    await createBranch(activeRepoId, { name: newBranchName, from: newBranchFrom || undefined });
    setNewBranchName('');
  }, 'Creating branch…');
  const handleDeleteBranch = () => runAction(() => deleteBranch(activeRepoId, { name: selectedBranch }), 'Deleting branch…');
  const handleMerge = () => runAction(() => merge(activeRepoId, { fromBranch: mergeFrom, strategy: mergeStrategy }), 'Merging…');
  const handleSuggest = async () => {
    if (!activeRepoId) return;
    setSuggesting(true);
    setError(null);
    try {
      const result = await suggestCommitMessage(activeRepoId);
      const suggestion = result?.suggestion || '';
      if (!commitMessage.trim()) {
        setCommitMessage(suggestion);
      }
      setLastSuggestion(suggestion);
    } catch (err) {
      setError(err.message);
    } finally {
      setSuggesting(false);
    }
  };

  const diffLines = diffText ? diffText.split('\n') : [];

  const handleSyncOffline = async () => {
    if (!activeRepoId || offlineSyncing) return;
    setOfflineSyncing(true);
    setError(null);
    try {
      await syncOfflineChanges(activeRepoId, { commitMessage: 'Synced offline edits' });
      setOfflinePending(false);
      if (onOfflineSync) {
        await onOfflineSync();
      }
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setOfflineSyncing(false);
    }
  };

  return (
    <div className="panel git-panel">
      <div className="panel-header">
        <h2>Git</h2>
        {status && <span className="ahead-behind">↑ {status.ahead} / ↓ {status.behind}</span>}
      </div>
      <div className="git-subnav">
        {gitTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={tab.key === activeSection ? 'active' : ''}
            onClick={() => setActiveSection(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSection === 'git' && (
        <>
          {loadingMessage && <p>{loadingMessage}</p>}
          {error && <p className="error-text">{error}</p>}

          <section className="git-section-block">
            <h3>Branches</h3>
            <div className="branch-controls">
              <label>
                Current Branch
                <select value={selectedBranch} onChange={(event) => setSelectedBranch(event.target.value)}>
                  {branches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={handleSwitchBranch} disabled={!selectedBranch}>
                Switch branch
              </button>
              <button
                onClick={handleDeleteBranch}
                className="danger"
                disabled={!selectedBranch || branches.length <= 1}
              >
                Delete branch
              </button>
            </div>
            <form
              className="new-branch"
              onSubmit={(event) => {
                event.preventDefault();
                handleCreateBranch();
              }}
            >
              <label>
                New branch name
                <input value={newBranchName} onChange={(event) => setNewBranchName(event.target.value)} required />
              </label>
              <label>
                From branch
                <input value={newBranchFrom} onChange={(event) => setNewBranchFrom(event.target.value)} />
              </label>
              <button type="submit">Create branch</button>
            </form>
          </section>

          <section className="git-section-block">
            <h3>Status</h3>
            {!status && <p>Loading status…</p>}
            {status && (
              <div className="status-columns">
                <div>
                  <h4>Staged</h4>
                  <StatusList items={status.staged} actionLabel="Unstage" onAction={handleUnstage} onOpenFile={onOpenFile} />
                </div>
                <div>
                  <h4>Unstaged</h4>
                  <StatusList items={status.unstaged} actionLabel="Stage" onAction={handleStage} onOpenFile={onOpenFile} />
                </div>
                <div>
                  <h4>Untracked</h4>
                  <StatusList items={status.untracked} actionLabel="Stage" onAction={handleStage} onOpenFile={onOpenFile} />
                </div>
              </div>
            )}
          </section>

          <section className="git-section-block">
            <h3>Diff</h3>
            <pre className="diff-viewer">
              {diffLines.map((line, index) => {
                let className = '';
                if (line.startsWith('+')) className = 'diff-add';
                if (line.startsWith('-')) className = 'diff-remove';
                return (
                  <div key={index} className={className}>
                    {line}
                  </div>
                );
              })}
            </pre>
          </section>

          <section className="git-section-block">
            <h3>Commit</h3>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleCommit();
              }}
              className="commit-form"
            >
              <label className="commit-message-label">
                <span>Message</span>
                <div className="commit-message-input-row">
                  <textarea value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} required rows={3} />
                  <button type="button" onClick={handleSuggest} disabled={suggesting}>
                    {suggesting ? 'Suggesting…' : 'Suggest'}
                  </button>
                </div>
                {suggesting && <p className="muted suggestion-hint">Generating suggestion…</p>}
                {lastSuggestion && !suggesting && commitMessage.trim() !== lastSuggestion.trim() && (
                  <p className="muted suggestion-hint">Suggestion: {lastSuggestion}</p>
                )}
              </label>
              <label>
                Author name
                <input value={authorName} onChange={(event) => setAuthorName(event.target.value)} required />
              </label>
              <label>
                Author email
                <input type="email" value={authorEmail} onChange={(event) => setAuthorEmail(event.target.value)} required />
              </label>
              <button type="submit">Commit</button>
            </form>
          </section>

          <section className="git-section-block">
            <h3>Sync</h3>
            <div className="sync-buttons">
              <button onClick={handleFetch}>Fetch</button>
              <button onClick={handlePush}>Push</button>
              <button onClick={handleSyncOffline} disabled={!offlinePending || offlineSyncing || !isOnline}>
                {offlineSyncing ? 'Syncing offline…' : 'Sync Offline Changes'}
              </button>
            </div>
            <p className="muted offline-hint">
              {offlinePending
                ? isOnline
                  ? 'Offline edits are waiting to sync.'
                  : 'Offline edits queued. Reconnect to sync.'
                : 'All offline edits are synced.'}
            </p>
            <form
              className="merge-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleMerge();
              }}
            >
              <label>
                From branch
                <input value={mergeFrom} onChange={(event) => setMergeFrom(event.target.value)} placeholder="origin/main" required />
              </label>
              <label>
                Strategy
                <select value={mergeStrategy} onChange={(event) => setMergeStrategy(event.target.value)}>
                  <option value="merge">merge</option>
                  <option value="rebase">rebase</option>
                </select>
              </label>
              <button type="submit">Merge/Rebase</button>
            </form>
          </section>

          <section className="git-section-block">
            <h3>Automation URLs</h3>
            <AutomationLinks repoId={activeRepoId} />
          </section>
        </>
      )}

      {activeSection === 'secrets' && <SecretsPanel repoId={activeRepoId} />}
      {activeSection === 'activity' && <ActivityPanel repoId={activeRepoId} />}
    </div>
  );
}

function StatusList({ items = [], actionLabel, onAction, onOpenFile }) {
  if (!items || items.length === 0) {
    return <p className="muted">None</p>;
  }
  return (
    <ul className="status-list">
      {items.map((item) => {
        const path = typeof item === 'string' ? item : item?.path || item?.name || '';
        if (!path) return null;
        return (
          <li key={path}>
            <button type="button" className="link" onClick={() => onOpenFile && onOpenFile(path)}>
              {path}
            </button>
            <button type="button" onClick={() => onAction(path)}>{actionLabel}</button>
          </li>
        );
      })}
    </ul>
  );
}

function AutomationLinks({ repoId }) {
  if (!repoId) return null;
  const base = API_BASE_URL.replace(/\/$/, '');
  const pushUrl = `${base}/shortcut/push?repoId=${encodeURIComponent(repoId)}`;
  const commitUrl = `${base}/shortcut/commit-and-push?repoId=${encodeURIComponent(repoId)}&msg=&name=${encodeURIComponent('Your Name')}&email=${encodeURIComponent('you@example.com')}`;
  const fetchUrl = `${base}/shortcut/fetch?repoId=${encodeURIComponent(repoId)}`;

  const items = [
    { label: 'Push current branch', value: pushUrl },
    { label: 'Commit & push (fill msg)', value: commitUrl },
    { label: 'Fetch from remote', value: fetchUrl }
  ];

  return (
    <div className="automation-list">
      {items.map((item) => (
        <AutomationUrlField key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );
}

function AutomationUrlField({ label, value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!navigator?.clipboard?.writeText) {
      setCopied(false);
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <label className="automation-item">
      <span>{label}</span>
      <div className="automation-field">
        <input type="text" value={value} readOnly onFocus={(event) => event.target.select()} />
        <button type="button" onClick={handleCopy}>{copied ? 'Copied!' : 'Copy'}</button>
      </div>
    </label>
  );
}
