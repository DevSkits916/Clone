import React, { useEffect, useState } from 'react';
import { fetchLfsFile, getLfsList, getTree } from '../hooks/useBackend.js';

const FOLDER_TYPES = new Set(['tree', 'directory', 'folder']);

export default function FileTreePanel({ activeRepoId, currentPath, onChangePath, onOpenFile }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lfsFiles, setLfsFiles] = useState({});
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!activeRepoId) {
      setItems([]);
      setLfsFiles({});
      return;
    }
    const load = async () => {
      setLoading(true);
      setError(null);
      setStatusMessage('');
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

  useEffect(() => {
    if (!activeRepoId) {
      setLfsFiles({});
      return;
    }
    let cancelled = false;
    getLfsList(activeRepoId)
      .then((response) => {
        if (cancelled) return;
        const map = {};
        const files = Array.isArray(response?.files) ? response.files : [];
        files.forEach((file) => {
          if (file?.path) {
            map[file.path] = file;
          }
        });
        setLfsFiles(map);
      })
      .catch(() => {
        if (!cancelled) {
          setLfsFiles({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeRepoId]);

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
    if (lfsFiles[targetPath]) {
      handleLfsDownload(targetPath, lfsFiles[targetPath]);
      return;
    }
    onOpenFile(targetPath);
  };

  const handleLfsDownload = async (targetPath, metadata) => {
    if (!activeRepoId) return;
    setStatusMessage(`Downloading ${targetPath}…`);
    setError(null);
    try {
      const response = await fetchLfsFile(activeRepoId, targetPath);
      const base64 = response?.content || '';
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i += 1) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const filename = targetPath.split('/').pop() || 'lfs-file';
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setStatusMessage(`Downloaded ${filename}${metadata?.size ? ` (${metadata.size} bytes)` : ''}.`);
    } catch (err) {
      setError(err.message);
      setStatusMessage('');
    }
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
      {statusMessage && !loading && <p className="muted">{statusMessage}</p>}
      {!loading && !error && items.length === 0 && <p>No files in this directory.</p>}
      <ul className="tree-list">
        {items.map((item) => {
          const isFolder = FOLDER_TYPES.has(item.type);
          const name = item.name || item.path || '';
          const targetPath = currentPath ? `${currentPath}/${name}` : name;
          const lfsInfo = lfsFiles[targetPath];
          return (
            <li key={item.path || item.name}>
              {isFolder ? (
                <button className="tree-item folder" onClick={() => handleFolderClick(item)}>
                  📁 {name}
                </button>
              ) : (
                <button className={`tree-item file${lfsInfo ? ' lfs' : ''}`} onClick={() => handleFileClick(item)}>
                  {lfsInfo ? '📦' : '📄'} {name}
                  {lfsInfo && <span className="lfs-tag">LFS</span>}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
