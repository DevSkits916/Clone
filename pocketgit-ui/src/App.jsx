import React, { useCallback, useEffect, useMemo, useState } from 'react';
import RepoListPanel from './components/RepoListPanel.jsx';
import FileTreePanel from './components/FileTreePanel.jsx';
import EditorPanel from './components/EditorPanel.jsx';
import GitPanel from './components/GitPanel.jsx';
import SearchPanel from './components/SearchPanel.jsx';
import SSHKeysPanel from './components/SSHKeysPanel.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import {
  OFFLINE_EVENT,
  clearAuthToken,
  getAuthToken,
  getReposWithOfflineChanges,
  onUnauthorized,
  setAuthToken as storeAuthToken,
  syncAllOfflineChanges
} from './hooks/useBackend.js';

const MOBILE_BREAKPOINT = 900;

const TABS = [
  { key: 'files', label: 'Files' },
  { key: 'editor', label: 'Editor' },
  { key: 'git', label: 'Git' },
  { key: 'search', label: 'Search' },
  { key: 'keys', label: 'SSH Keys' }
];

const HTML_EXTENSIONS = ['.html', '.htm'];

function decodeTokenUsername(token) {
  if (!token) return null;
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    let json = '';
    if (typeof atob === 'function') {
      json = atob(padded);
    } else if (typeof Buffer !== 'undefined') {
      json = Buffer.from(padded, 'base64').toString('utf-8');
    }
    if (!json) {
      return null;
    }
    const data = JSON.parse(json);
    return data?.sub || null;
  } catch (error) {
    return null;
  }
}

export default function App() {
  const [authToken, setAuthTokenState] = useState(() => getAuthToken());
  const [currentUser, setCurrentUser] = useState(() => decodeTokenUsername(getAuthToken()));
  const [activeRepoId, setActiveRepoId] = useState(null);
  const [activeFilePath, setActiveFilePath] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [editorMode, setEditorMode] = useState('editor');
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('files');
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [pendingOfflineRepos, setPendingOfflineRepos] = useState([]);

  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      setAuthTokenState(null);
      setCurrentUser(null);
    });
    return unsubscribe;
  }, []);

  const refreshOfflineState = useCallback(async () => {
    if (!authToken) {
      setPendingOfflineRepos([]);
      return [];
    }
    try {
      const repos = await getReposWithOfflineChanges();
      setPendingOfflineRepos(repos);
      return repos;
    } catch (error) {
      return [];
    }
  }, [authToken]);

  const syncOfflineEdits = useCallback(
    async (commitMessage = 'Offline edits sync', force = false) => {
      if (!authToken) {
        return;
      }
      if (!force && !isOnline) {
        return;
      }
      setSyncError(null);
      setIsSyncing(true);
      try {
        const results = await syncAllOfflineChanges({ commitMessage });
        const failures = (results || []).filter((entry) => entry && entry.error);
        if (failures.length) {
          const details = failures.map((entry) => entry.error?.message || String(entry.error)).join('; ');
          throw new Error(details || 'Some repositories could not be synced');
        }
      } catch (error) {
        setSyncError(error.message);
      } finally {
        setIsSyncing(false);
        refreshOfflineState();
      }
    },
    [authToken, isOnline, refreshOfflineState]
  );

  const handleLoginSuccess = useCallback(
    ({ token, username }) => {
      if (!token) return;
      storeAuthToken(token);
      setAuthTokenState(token);
      setCurrentUser(username || decodeTokenUsername(token));
    },
    []
  );

  const handleLogout = useCallback(() => {
    clearAuthToken();
    setAuthTokenState(null);
    setCurrentUser(null);
    setPendingOfflineRepos([]);
  }, []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
    };
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineEdits('Offline edits sync', true);
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [syncOfflineEdits]);

  useEffect(() => {
    if (!authToken) {
      return;
    }
    refreshOfflineState().then((repos) => {
      if (repos.length && isOnline) {
        syncOfflineEdits('Offline edits sync');
      }
    });
    const handleOfflineEvent = () => {
      refreshOfflineState();
    };
    window.addEventListener(OFFLINE_EVENT, handleOfflineEvent);
    return () => {
      window.removeEventListener(OFFLINE_EVENT, handleOfflineEvent);
    };
  }, [authToken, isOnline, refreshOfflineState, syncOfflineEdits]);

  useEffect(() => {
    setCurrentPath('');
    setActiveFilePath(null);
  }, [activeRepoId]);

  useEffect(() => {
    if (!activeFilePath) return;
    const lower = activeFilePath.toLowerCase();
    const isHtml = HTML_EXTENSIONS.some((ext) => lower.endsWith(ext));
    if (!isHtml && editorMode !== 'editor') {
      setEditorMode('editor');
    }
  }, [activeFilePath, editorMode]);

  if (!authToken) {
    return <LoginScreen onLogin={handleLoginSuccess} />;
  }

  const layoutClass = useMemo(() => (isMobile ? 'app-shell mobile' : 'app-shell desktop'), [isMobile]);

  const handleOpenFile = (path) => {
    setActiveFilePath(path);
    if (isMobile) {
      setActiveTab('editor');
    }
  };

  const bannerMessage = useMemo(() => {
    if (!isOnline) {
      const pendingCount = pendingOfflineRepos.length;
      if (pendingCount > 0) {
        return `Offline Mode — ${pendingCount} repo${pendingCount === 1 ? '' : 's'} waiting to sync`;
      }
      return 'Offline Mode';
    }
    if (isSyncing) {
      return 'Syncing offline edits…';
    }
    if (syncError) {
      return `Sync failed: ${syncError}`;
    }
    if (pendingOfflineRepos.length > 0) {
      return `Pending offline changes in ${pendingOfflineRepos.length} repo${pendingOfflineRepos.length === 1 ? '' : 's'}`;
    }
    return null;
  }, [isOnline, isSyncing, pendingOfflineRepos.length, syncError]);

  const handleBannerSync = () => {
    if (!isOnline) return;
    syncOfflineEdits('Offline edits sync', true);
  };

  const renderMobilePanel = () => {
    switch (activeTab) {
      case 'files':
        return (
          <div className="panel-container">
            <RepoListPanel
              activeRepoId={activeRepoId}
              onSelectRepo={setActiveRepoId}
            />
            <FileTreePanel
              activeRepoId={activeRepoId}
              currentPath={currentPath}
              onChangePath={setCurrentPath}
              onOpenFile={handleOpenFile}
            />
          </div>
        );
      case 'editor':
        return (
          <EditorPanel
            key={`${activeRepoId || 'no-repo'}-${activeFilePath || 'no-file'}`}
            activeRepoId={activeRepoId}
            filePath={activeFilePath}
            mode={editorMode}
            onModeChange={setEditorMode}
          />
        );
      case 'git':
        return (
          <GitPanel
            activeRepoId={activeRepoId}
            onOpenFile={handleOpenFile}
            offlineQueued={pendingOfflineRepos.includes(activeRepoId)}
            onOfflineSync={() => syncOfflineEdits('Synced offline edits', true)}
          />
        );
      case 'search':
        return (
          <SearchPanel
            activeRepoId={activeRepoId}
            onOpenFile={handleOpenFile}
          />
        );
      case 'keys':
        return (
          <SSHKeysPanel
            isOnline={isOnline}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={layoutClass}>
      <header className="app-header">
        <h1>PocketGit</h1>
        <div className="header-meta">
          {activeRepoId && <span className="repo-id">Repo: {activeRepoId}</span>}
          <div className="auth-controls">
            {currentUser && <span className="user-badge">Signed in as {currentUser}</span>}
            <button type="button" className="secondary" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>
      {bannerMessage && (
        <div
          className={`status-banner ${!isOnline ? 'offline' : syncError ? 'error' : isSyncing ? 'syncing' : 'pending'}`}
        >
          <span>{bannerMessage}</span>
          {isOnline && (isSyncing || pendingOfflineRepos.length > 0 || syncError) && (
            <button type="button" onClick={handleBannerSync} disabled={isSyncing}>
              {isSyncing ? 'Syncing…' : 'Sync now'}
            </button>
          )}
        </div>
      )}
      {isMobile ? (
        <>
          <nav className="tab-bar">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className={tab.key === activeTab ? 'tab active' : 'tab'}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <main className="mobile-main">
            {renderMobilePanel()}
          </main>
        </>
      ) : (
        <main className="desktop-main">
          <aside className="sidebar">
            <RepoListPanel
              activeRepoId={activeRepoId}
              onSelectRepo={setActiveRepoId}
            />
            <FileTreePanel
              activeRepoId={activeRepoId}
              currentPath={currentPath}
              onChangePath={setCurrentPath}
              onOpenFile={handleOpenFile}
            />
            <SSHKeysPanel isOnline={isOnline} />
          </aside>
          <section className="editor-section">
            <EditorPanel
              key={`${activeRepoId || 'no-repo'}-${activeFilePath || 'no-file'}`}
              activeRepoId={activeRepoId}
              filePath={activeFilePath}
              mode={editorMode}
              onModeChange={setEditorMode}
            />
          </section>
          <aside className="git-section">
            <GitPanel
              activeRepoId={activeRepoId}
              onOpenFile={handleOpenFile}
              offlineQueued={pendingOfflineRepos.includes(activeRepoId)}
              onOfflineSync={() => {
                syncOfflineEdits('Synced offline edits', true);
              }}
            />
            <SearchPanel
              activeRepoId={activeRepoId}
              onOpenFile={handleOpenFile}
            />
          </aside>
        </main>
      )}
    </div>
  );
}
