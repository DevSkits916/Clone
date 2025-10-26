import React, { useEffect, useMemo, useState } from 'react';
import RepoListPanel from './components/RepoListPanel.jsx';
import FileTreePanel from './components/FileTreePanel.jsx';
import EditorPanel from './components/EditorPanel.jsx';
import GitPanel from './components/GitPanel.jsx';
import SearchPanel from './components/SearchPanel.jsx';

const MOBILE_BREAKPOINT = 900;

const TABS = [
  { key: 'files', label: 'Files' },
  { key: 'editor', label: 'Editor' },
  { key: 'git', label: 'Git' },
  { key: 'search', label: 'Search' }
];

const HTML_EXTENSIONS = ['.html', '.htm'];

export default function App() {
  const [activeRepoId, setActiveRepoId] = useState(null);
  const [activeFilePath, setActiveFilePath] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [editorMode, setEditorMode] = useState('editor');
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState('files');

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const layoutClass = useMemo(() => (isMobile ? 'app-shell mobile' : 'app-shell desktop'), [isMobile]);

  const handleOpenFile = (path) => {
    setActiveFilePath(path);
    if (isMobile) {
      setActiveTab('editor');
    }
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
          />
        );
      case 'search':
        return (
          <SearchPanel
            activeRepoId={activeRepoId}
            onOpenFile={handleOpenFile}
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
        {activeRepoId && <span className="repo-id">Repo: {activeRepoId}</span>}
      </header>
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
