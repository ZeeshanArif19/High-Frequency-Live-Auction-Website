/**
 * client/src/components/Auth/AuthModal.jsx
 *
 * Modal for user authentication: tabbed between Sign In and Registration.
 */

import React, { useState } from 'react';
import { login, register } from '../../services/authService.js';

export function AuthModal({ isOpen, onClose, onSuccess, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let result;
      if (mode === 'register') {
        result = await register({ email, username, password });
      } else {
        result = await login({ email, password });
      }

      setLoading(false);
      if (onSuccess) onSuccess(result.user);
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Authentication failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-surface-container border border-outline-variant/40 rounded-xl shadow-2xl max-w-md w-full p-6 relative overflow-hidden">
        {/* Subtle accent glow */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-secondary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface p-1 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {/* Header Tabs */}
        <div className="flex border-b border-outline-variant/30 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 py-3 text-sm font-label-bold uppercase tracking-wider transition-colors border-b-2 ${
              mode === 'login'
                ? 'border-secondary text-secondary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 py-3 text-sm font-label-bold uppercase tracking-wider transition-colors border-b-2 ${
              mode === 'register'
                ? 'border-secondary text-secondary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Subtitle */}
        <p className="text-xs text-on-surface-variant mb-5 font-mono">
          {mode === 'login'
            ? 'Access the live bidding terminal & manage lots.'
            : 'Register to place atomic bids and create auctions.'}
        </p>

        {/* Error notification */}
        {error && (
          <div className="mb-4 p-3 bg-error/15 border border-error/30 rounded-lg flex items-center gap-2 text-xs text-error">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. apex_trader"
                className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2.5 text-sm text-on-surface font-mono focus:outline-none focus:border-secondary"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="trader@bidstream.com"
              className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2.5 text-sm text-on-surface font-mono focus:outline-none focus:border-secondary"
            />
          </div>

          <div>
            <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2.5 text-sm text-on-surface font-mono focus:outline-none focus:border-secondary"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full bg-secondary text-on-secondary hover:bg-secondary/90 py-3 rounded-lg font-label-bold text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(217,119,6,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <span className="material-symbols-outlined text-sm animate-spin">refresh</span>}
            <span>
              {loading
                ? 'Processing...'
                : mode === 'login'
                ? 'Authenticate & Enter'
                : 'Create Account'}
            </span>
          </button>
        </form>

        {mode === 'login' && (
          <p className="text-[11px] text-on-surface-variant/70 text-center mt-4 font-mono">
            Demo account: <span className="text-secondary">demo@bidstream.com</span> / <span className="text-secondary">password123</span>
          </p>
        )}
      </div>
    </div>
  );
}
