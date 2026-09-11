/**
 * client/src/components/Auction/AuctionDetailPage.jsx
 *
 * Detailed auction page with images, specs, and bidding terminal with owner actions.
 */

import React, { useState } from 'react';
import { AuctionImages } from './AuctionImages.jsx';
import { BiddingTerminal } from './BiddingTerminal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export function AuctionDetailPage({ product, onNavigateBack, onAuctionSelect }) {
  const [currentProduct, setCurrentProduct] = useState(product);
  const { user, isAuthenticated, openLogin, openRegister, openCreateAuction, openMyBids, logout } =
    useAuth();

  const handleAuctionUpdated = (updated) => {
    setCurrentProduct(updated);
  };

  const handleAuctionDeleted = () => {
    onNavigateBack();
  };

  return (
    <div className="min-h-screen flex flex-col w-full bg-surface text-on-surface">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_12px_rgba(0,0,0,0.3)] border-b border-outline-variant/30">
        <div className="h-20 w-full px-8 md:px-16 flex items-center justify-between max-w-[1440px] mx-auto">
          {/* Back Button and Logo */}
          <div className="flex items-center gap-4">
            <button
              onClick={onNavigateBack}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors group cursor-pointer"
              title="Go back to live lots"
            >
              <span
                className="material-symbols-outlined text-on-surface group-hover:text-secondary transition-colors"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                arrow_back
              </span>
            </button>
            <button
              onClick={onNavigateBack}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
            >
              <span className="font-headline-md text-headline-md tracking-tight uppercase text-on-surface">
                BidStream
              </span>
            </button>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={onNavigateBack}
              className="transition-colors text-secondary font-bold text-sm hover:opacity-80 cursor-pointer"
            >
              Live Lots
            </button>
            <button
              onClick={openCreateAuction}
              className="font-label-bold text-xs uppercase tracking-wider text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-secondary">add_circle</span>
              List Lot
            </button>
          </nav>

          {/* User Controls */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={openMyBids}
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-xs font-mono text-on-surface border border-outline-variant/40 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm text-secondary">history</span>
                  <span>My Bids</span>
                </button>

                <div className="flex items-center gap-2 pl-2 border-l border-outline-variant/30">
                  <div className="w-8 h-8 rounded-full border border-secondary/50 bg-surface-container-high flex items-center justify-center font-mono text-xs text-secondary font-bold uppercase">
                    {user?.username?.slice(0, 2) || 'U'}
                  </div>
                  <span className="hidden lg:inline text-xs font-bold font-mono text-on-surface">
                    @{user?.username}
                  </span>
                </div>

                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={openLogin}
                  className="px-4 py-2 rounded-lg text-xs font-label-bold uppercase tracking-wider text-on-surface hover:text-secondary hover:bg-surface-container transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={openRegister}
                  className="px-4 py-2 rounded-lg text-xs font-label-bold uppercase tracking-wider bg-secondary text-on-secondary hover:bg-secondary/90 transition-all font-bold cursor-pointer"
                >
                  Register
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full pt-20 flex-1 bg-surface">
        <div className="px-8 py-12 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full">
          {/* Left Column: Images */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <AuctionImages product={currentProduct} />
          </div>

          {/* Right Column: Bidding Terminal */}
          <div className="lg:col-span-4">
            <BiddingTerminal
              product={currentProduct}
              onAuctionUpdated={handleAuctionUpdated}
              onAuctionDeleted={handleAuctionDeleted}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-container-lowest py-6 border-t border-outline-variant/30">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-6 text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="font-label-bold text-label-bold">© 2024 BIDSTREAM GLOBAL</span>
          </div>
          <div className="flex gap-8">
            <a className="text-label-sm font-label-sm hover:text-on-surface transition-colors" href="#">
              Terms
            </a>
            <a className="text-label-sm font-label-sm hover:text-on-surface transition-colors" href="#">
              Privacy
            </a>
            <a className="text-label-sm font-label-sm hover:text-on-surface transition-colors" href="#">
              Security
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
