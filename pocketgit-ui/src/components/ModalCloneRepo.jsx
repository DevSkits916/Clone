import React, { useEffect, useState } from 'react';

export default function ModalCloneRepo({ isOpen, onClose, onSubmit, isLoading, error, sshKeys = [] }) {
  const [formState, setFormState] = useState({
    url: '',
    branch: '',
    username: '',
    password: '',
    sshKeyId: ''
  });

  useEffect(() => {
    if (!isOpen) {
      setFormState({ url: '', branch: '', username: '', password: '', sshKeyId: '' });
    }
  }, [isOpen]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = {
      url: formState.url,
      branch: formState.branch || undefined,
      username: formState.username || undefined,
      password: formState.password || undefined,
      sshKeyId: formState.sshKeyId || undefined
    };
    onSubmit(payload);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <header className="modal-header">
          <h2>Clone New Repository</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <form className="modal-form" onSubmit={handleSubmit}>
          <label>
            Repository URL
            <input
              type="url"
              name="url"
              value={formState.url}
              onChange={handleChange}
              required
              placeholder="https://github.com/user/repo.git"
            />
          </label>
          <label>
            Branch (optional)
            <input
              type="text"
              name="branch"
              value={formState.branch}
              onChange={handleChange}
              placeholder="main"
            />
          </label>
          <label>
            Username (optional)
            <input
              type="text"
              name="username"
              value={formState.username}
              onChange={handleChange}
            />
          </label>
          <label>
            Password (optional)
            <input
              type="password"
              name="password"
              value={formState.password}
              onChange={handleChange}
            />
          </label>
          <label>
            SSH key (optional)
            <select name="sshKeyId" value={formState.sshKeyId} onChange={handleChange}>
              <option value="">Use default SSH agent</option>
              {sshKeys.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.name || key.id}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="secondary">Cancel</button>
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Cloning…' : 'Clone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
