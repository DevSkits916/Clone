import React, { useEffect, useState } from 'react';
import { getTree } from '../hooks/useBackend.js';

const FOLDER_TYPES = new Set(['tree', 'directory', 'folder']);

export default function FileTreePanel({ activeRepoId, currentPath, onChangePath, onOpenFile }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!activeRepoId) {
      setItems([]);
      return;
    }
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getTree(activeRepoId, currentPath || '');
        const sorted = [...(Array.isArray(data) ? data : [])].sort((a, b) => {
          const aIsFolder = FOLDER_TYPES.has(a.type);
          const bIsFolder = FOLDER_TYPES.has(b.type);
          const aName = a.name || a.path || '';
          const bName = b.name || b.path || '';
          if (aIsFolder === bIsFolder) {
            return aName.localeCompare(bName);
          }
          return aIsFolder ? -1 : 1;
        });
        setItems(sorted);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeRepoId, currentPath]);

  const handleFolderClick = (item) => {
    const name = item.name || item.path?.split('/').pop();
    if (!name) return;
    const nextPath = currentPath ? `${currentPath}/${name}` : name;
    onChangePath(nextPath);
  };

  const handleFileClick = (item) => {
    const name = item.name || item.path?.split('/').pop();
    if (!name) return;
    const targetPath = currentPath ? `${currentPath}/${name}` : name;
    onOpenFile(targetPath);
  };

  const handleUp = () => {
    if (!currentPath) return;
    const segments = currentPath.split('/');
    segments.pop();
    onChangePath(segments.join('/'));
  };

  if (!activeRepoId) {
    return (
      <div className="panel file-tree">
        <p>Select a repository to browse files.</p>
      </div>
    );
  }

  return (
    <div className="panel file-tree">
      <div className="panel-header">
        <h2>Files</h2>
        <div className="breadcrumb">
          <button onClick={handleUp} disabled={!currentPath} className="secondary">Up</button>
          <span>{currentPath || '/'}</span>
        </div>
      </div>
      {loading && <p>Loading…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && items.length === 0 && <p>No files in this directory.</p>}
      <ul className="tree-list">
        {items.map((item) => {
          const isFolder = FOLDER_TYPES.has(item.type);
          const name = item.name || item.path || '';
          return (
            <li key={item.path || item.name}>
              {isFolder ? (
                <button className="tree-item folder" onClick={() => handleFolderClick(item)}>
                  📁 {name}
                </button>
              ) : (
                <button className="tree-item file" onClick={() => handleFileClick(item)}>
                  📄 {name}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
