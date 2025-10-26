import React, { useState } from 'react';
import { loginUser, registerUser } from '../hooks/useBackend.js';

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (!username.trim() || !password) {
      setError('Username and password are required.');
      return;
    }

    setLoading(true);
    try {
      if (isRegistering) {
        await registerUser({ username, password });
        setInfo('Account created. You can now sign in.');
        setIsRegistering(false);
      }
      const result = await loginUser({ username, password });
      if (onLogin) {
        onLogin({ token: result.token, username });
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>PocketGit</h1>
        <p className="login-subtitle">Sign in to continue managing your repositories.</p>
        <form onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              disabled={loading}
              required
            />
          </label>
          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              disabled={loading}
              required
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          {info && <p className="info-text">{info}</p>}
          <div className="login-actions">
            <button type="submit" disabled={loading}>
              {loading ? 'Please wait…' : isRegistering ? 'Register & Sign In' : 'Sign In'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setIsRegistering((value) => !value);
                setError(null);
                setInfo(null);
              }}
              disabled={loading}
            >
              {isRegistering ? 'Have an account? Sign in' : 'Need an account? Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
