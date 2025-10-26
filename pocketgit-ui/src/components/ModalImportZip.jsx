import React, { useEffect, useRef, useState } from 'react';

export default function ModalImportZip({ isOpen, onClose, onSubmit, isLoading, error }) {
  const [file, setFile] = useState(null);
  const [repoName, setRepoName] = useState('');
  const [localError, setLocalError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setRepoName('');
      setLocalError('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleFileChange = (event) => {
    setLocalError('');
    const selectedFile = event.target.files && event.target.files[0];
    setFile(selectedFile || null);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!file) {
      setLocalError('Please select a .zip file to import.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    if (repoName.trim()) {
      formData.append('repoName', repoName.trim());
    }
    onSubmit(formData);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <header className="modal-header">
          <h2>Import Project (.zip)</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <form className="modal-form" onSubmit={handleSubmit}>
          <label>
            Zip file
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              onChange={handleFileChange}
              required
            />
          </label>
          <label>
            Repo name (optional)
            <input
              type="text"
              value={repoName}
              onChange={(event) => setRepoName(event.target.value)}
              placeholder="Project name"
            />
          </label>
          {(localError || error) && <p className="error-text">{localError || error}</p>}
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="secondary">Cancel</button>
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Importing…' : 'Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
