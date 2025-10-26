import React, { useEffect, useRef, useState } from 'react';
import { getFile, saveFile } from '../hooks/useBackend.js';
import { loadMonaco } from '../utils/monacoLoader.js';
import { attachConsoleListener, buildPreviewDocument, sendScriptToIframe } from '../utils/iframePreview.js';

const HTML_EXTENSIONS = ['.html', '.htm'];

function detectLanguage(path = '') {
  if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
  if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.html') || path.endsWith('.htm')) return 'html';
  if (path.endsWith('.py')) return 'python';
  if (path.endsWith('.md')) return 'markdown';
  if (path.endsWith('.yml') || path.endsWith('.yaml')) return 'yaml';
  return 'plaintext';
}

function isHtmlFile(path = '') {
  return HTML_EXTENSIONS.some((ext) => path.endsWith(ext));
}

export default function EditorPanel({ activeRepoId, filePath, mode, onModeChange }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [previewLogs, setPreviewLogs] = useState([]);
  const [consoleInput, setConsoleInput] = useState('');

  const editorContainerRef = useRef(null);
  const editorInstanceRef = useRef(null);
  const iframeRef = useRef(null);
  const logEndRef = useRef(null);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    if (!activeRepoId || !filePath) {
      setContent('');
      setDirty(false);
      setError(null);
      return;
    }
    let ignore = false;
    setLoading(true);
    setError(null);
    setInfoMessage('');
    getFile(activeRepoId, filePath)
      .then((data) => {
        if (ignore) return;
        const nextContent = typeof data === 'string' ? data : data?.content ?? '';
        setContent(nextContent);
        setDirty(false);
        if (typeof data === 'object' && data?.offline) {
          setInfoMessage('Loaded cached copy. Changes will sync when you reconnect.');
        } else {
          setInfoMessage('');
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [activeRepoId, filePath]);

  useEffect(() => {
    if (mode !== 'editor' || !filePath || !editorContainerRef.current) {
      return;
    }
    let cancelled = false;
    loadMonaco().then((monaco) => {
      if (cancelled) return;
      if (editorInstanceRef.current) {
        const model = editorInstanceRef.current.getModel();
        if (model) {
          monaco.editor.setModelLanguage(model, detectLanguage(filePath));
        }
        return;
      }
      editorInstanceRef.current = monaco.editor.create(editorContainerRef.current, {
        value: content ?? '',
        language: detectLanguage(filePath),
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14
      });
      editorInstanceRef.current.onDidChangeModelContent(() => {
        if (isUpdatingRef.current) {
          isUpdatingRef.current = false;
          return;
        }
        const value = editorInstanceRef.current.getValue();
        setContent(value);
        setDirty(true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [mode, filePath]);

  useEffect(() => {
    if (editorInstanceRef.current && mode === 'editor') {
      const model = editorInstanceRef.current.getModel();
      if (model && model.getValue() !== content) {
        const position = editorInstanceRef.current.getPosition();
        isUpdatingRef.current = true;
        model.setValue(content ?? '');
        if (position) {
          editorInstanceRef.current.setPosition(position);
        }
      }
    }
  }, [content, mode]);

  useEffect(() => {
    const detach = attachConsoleListener((payload) => {
      if (payload.method === 'clear') {
        setPreviewLogs([]);
        return;
      }
      setPreviewLogs((prev) => [...prev, { method: payload.method, text: payload.args.join(' ') }]);
    });
    return detach;
  }, []);

  useEffect(() => {
    if (mode !== 'preview' || !isHtmlFile(filePath) || !iframeRef.current) {
      return;
    }
    iframeRef.current.srcdoc = buildPreviewDocument(content ?? '');
    setPreviewLogs([]);
  }, [mode, content, filePath]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [previewLogs]);

  useEffect(() => () => {
    if (editorInstanceRef.current) {
      editorInstanceRef.current.dispose();
      editorInstanceRef.current = null;
    }
  }, []);

  if (!activeRepoId) {
    return (
      <div className="panel editor-panel">
        <p>Select a repository to start editing.</p>
      </div>
    );
  }

  if (!filePath) {
    return (
      <div className="panel editor-panel">
        <p>Choose a file from the tree to edit.</p>
      </div>
    );
  }

  const canPreview = isHtmlFile(filePath.toLowerCase());

  const handleSave = async () => {
    if (!dirty || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const result = await saveFile(activeRepoId, filePath, content);
      if (result?.offline) {
        setInfoMessage('Saved locally. Changes will sync once you are online.');
        if (result?.error) {
          setError(result.error.message || String(result.error));
        }
      } else {
        setInfoMessage('');
      }
      setDirty(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunScript = (event) => {
    event.preventDefault();
    const trimmed = consoleInput.trim();
    if (!trimmed) return;
    setPreviewLogs((prev) => [...prev, { method: 'input', text: trimmed }]);
    sendScriptToIframe(iframeRef.current, trimmed);
    setConsoleInput('');
  };

  return (
    <div className="panel editor-panel">
      <div className="editor-header">
        <span className="file-path">{filePath}</span>
        <div className="editor-actions">
          <button onClick={handleSave} disabled={loading || isSaving || !dirty}>
            {isSaving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
          {canPreview && (
            <button onClick={() => onModeChange(mode === 'editor' ? 'preview' : 'editor')}>
              {mode === 'editor' ? 'Show Preview' : 'Show Editor'}
            </button>
          )}
        </div>
      </div>
      {loading && <p>Loading file…</p>}
      {infoMessage && !loading && <p className="info-text">{infoMessage}</p>}
      {error && <p className="error-text">{error}</p>}
      {mode === 'editor' && (
        <div className="editor-container" ref={editorContainerRef} />
      )}
      {mode === 'preview' && canPreview && (
        <div className="preview-container">
          <iframe
            title="HTML Preview"
            ref={iframeRef}
            sandbox="allow-scripts"
          />
          <div className="preview-console-panel">
            <div className="console-header">
              <span>Console Output</span>
              <button type="button" onClick={() => setPreviewLogs([])}>Clear</button>
            </div>
            <div className="console-log">
              {previewLogs.length === 0 ? (
                <p className="muted">Console messages will appear here.</p>
              ) : (
                previewLogs.map((log, index) => (
                  <div key={index} className={`log-line ${log.method}`}>
                    <span className="log-method">{log.method}:</span> {log.text}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
          <form className="preview-console-input" onSubmit={handleRunScript}>
            <label>
              Run JavaScript in preview
              <div className="console-input-row">
                <input
                  type="text"
                  value={consoleInput}
                  onChange={(event) => setConsoleInput(event.target.value)}
                  placeholder="Type JavaScript here"
                />
                <button type="submit">Run</button>
              </div>
            </label>
          </form>
        </div>
      )}
      {mode === 'preview' && !canPreview && (
        <p className="muted">Preview available only for HTML files.</p>
      )}
    </div>
  );
}
