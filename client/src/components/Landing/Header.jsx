/**
 * client/src/components/Landing/Header.jsx
 *
 * Header component with navigation, auction listing trigger, and authentication controls.
 */

import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';

export function Header({ onNavigateToProducts, onNavigateHome }) {
  const { user, isAuthenticated, openLogin, openRegister, openCreateAuction, openMyBids, openMyAuctions, logout } =
    useAuth();

  const logoUrl =
    'https://lh3.googleusercontent.com/aida-public/AB6AXuD0eMdRYVC0X281HJEnaCJvv1skLQQBC5DaL1bQ8HIddaiQprIgJUX7grzD5-5lbZl_Z2DTxSWeAplP1ATTpT5kLKIzeZ_ZMPifgTN1iRzVXcYsQ9cVhnVENQR9NJQI2vYGRDDIZejtGbdsqNwfpoYj1xAlXjWjLhpzX3vx7gZpGATfInud6PbsErF_BZRIbNs_EKHk5fVLceYSzhsUz-yPS9SI-vPIq9baQLsTQ29ldFu3s0tMgmxbNw';

  return (
    <header className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_12px_rgba(0,0,0,0.3)] border-b border-outline-variant/30">
      <div className="h-20 w-full px-8 md:px-16 lg:px-24 flex items-center justify-between max-w-[1440px] mx-auto">
        {/* Left section: Logo and Navigation */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <img
              alt="BidStream Logo"
              className="h-8 w-auto object-contain brightness-0 invert"
              src={logoUrl}
            />
            <span className="font-headline-md text-headline-md tracking-tight uppercase text-on-surface">
              BidStream
            </span>
          </button>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={onNavigateToProducts}
              className="transition-colors text-secondary font-bold hover:opacity-80 text-sm"
            >
              Live Auctions
            </button>
            <button
              onClick={openCreateAuction}
              className="font-label-bold text-xs uppercase tracking-wider text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm text-secondary">add_circle</span>
              List Lot
            </button>
          </nav>
        </div>

        {/* Right section: Authentication & User Actions */}
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <button
                onClick={openMyBids}
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-xs font-mono text-on-surface border border-outline-variant/40 transition-colors"
                title="View My Bids"
              >
                <span className="material-symbols-outlined text-sm text-secondary">history</span>
                <span>My Bids</span>
              </button>

              <button
                onClick={openMyAuctions}
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-xs font-mono text-on-surface border border-outline-variant/40 transition-colors"
                title="My Auction Lots"
              >
                <span className="material-symbols-outlined text-sm text-secondary">gavel</span>
                <span>My Lots</span>
              </button>

              <button
                onClick={openCreateAuction}
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary/15 hover:bg-secondary/25 text-xs font-mono text-secondary border border-secondary/40 transition-colors font-bold"
              >
                <span>+ List Lot</span>
              </button>

              <div className="flex items-center gap-2 pl-2 border-l border-outline-variant/30">
                <div className="w-8 h-8 rounded-full border border-secondary/50 bg-surface-container-high flex items-center justify-center font-mono text-xs text-secondary font-bold uppercase">
                  {user?.username?.slice(0, 2) || 'U'}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-bold text-on-surface font-mono leading-none">
                    @{user?.username}
                  </span>
                  <span className="text-[10px] text-secondary font-mono leading-none mt-1">
                    {user?.role || 'USER'}
                  </span>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                title="Sign Out"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={openLogin}
                className="px-4 py-2 rounded-lg text-xs font-label-bold uppercase tracking-wider text-on-surface hover:text-secondary hover:bg-surface-container transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={openRegister}
                className="px-4 py-2 rounded-lg text-xs font-label-bold uppercase tracking-wider bg-secondary text-on-secondary hover:bg-secondary/90 transition-all shadow-[0_0_10px_rgba(217,119,6,0.3)] font-bold"
              >
                Register
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
