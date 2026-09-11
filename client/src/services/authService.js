/**
 * client/src/services/authService.js
 *
 * Authentication service handling user registration, login, logout,
 * and JWT token storage (AGENTS.md §7, §8).
 */

const API_BASE_URL =
  typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:3000'
    : '';

const TOKEN_KEY = 'bidstream_token';
const USER_KEY = 'bidstream_user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuth(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event('bidstream:auth_change'));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event('bidstream:auth_change'));
}

export function isAuthenticated() {
  return Boolean(getToken());
}

/**
 * Register a new user account.
 *
 * @param {{ username: string, email: string, password: string }} credentials
 * @returns {Promise<{ user: object, token: string }>}
 */
export async function register({ username, email, password }) {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ username, email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    const errorMsg = data.error || data.details?.[0]?.message || 'Registration failed';
    throw new Error(errorMsg);
  }

  setAuth(data.token, data.user);
  return data;
}

/**
 * Log in to an existing user account.
 *
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ user: object, token: string }>}
 */
export async function login({ email, password }) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    const errorMsg = data.error || data.details?.[0]?.message || 'Invalid credentials';
    throw new Error(errorMsg);
  }

  setAuth(data.token, data.user);
  return data;
}

/**
 * Log out and clear state.
 */
export function logout() {
  clearAuth();
}

/**
 * Fetch authenticated user profile from backend.
 *
 * @returns {Promise<object>}
 */
export async function fetchProfile() {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      clearAuth();
    }
    throw new Error(data.error || 'Failed to fetch user profile');
  }

  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}
