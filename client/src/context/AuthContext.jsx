/**
 * client/src/context/AuthContext.jsx
 *
 * React context providing global authentication state and modal controls.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, getToken, logout as doLogout, fetchProfile } from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getCurrentUser());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [createAuctionOpen, setCreateAuctionOpen] = useState(false);
  const [myBidsOpen, setMyBidsOpen] = useState(false);
  const [myAuctionsOpen, setMyAuctionsOpen] = useState(false);

  // Sync state across storage events and profile check
  useEffect(() => {
    const handleAuthChange = () => {
      setUser(getCurrentUser());
    };

    window.addEventListener('bidstream:auth_change', handleAuthChange);

    // If token exists, verify & refresh profile silently
    if (getToken()) {
      fetchProfile()
        .then((profile) => setUser(profile))
        .catch(() => setUser(null));
    }

    return () => {
      window.removeEventListener('bidstream:auth_change', handleAuthChange);
    };
  }, []);

  const openLogin = () => {
    setAuthModalMode('login');
    setAuthModalOpen(true);
  };

  const openRegister = () => {
    setAuthModalMode('register');
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const openCreateAuction = () => {
    if (!user) {
      openLogin();
      return;
    }
    setCreateAuctionOpen(true);
  };

  const closeCreateAuction = () => {
    setCreateAuctionOpen(false);
  };

  const openMyBids = () => {
    if (!user) {
      openLogin();
      return;
    }
    setMyBidsOpen(true);
  };

  const closeMyBids = () => {
    setMyBidsOpen(false);
  };

  const openMyAuctions = () => {
    if (!user) {
      openLogin();
      return;
    }
    setMyAuctionsOpen(true);
  };

  const closeMyAuctions = () => {
    setMyAuctionsOpen(false);
  };

  const logout = () => {
    doLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        authModalOpen,
        authModalMode,
        createAuctionOpen,
        myBidsOpen,
        myAuctionsOpen,
        openLogin,
        openRegister,
        closeAuthModal,
        openCreateAuction,
        closeCreateAuction,
        openMyBids,
        closeMyBids,
        openMyAuctions,
        closeMyAuctions,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
