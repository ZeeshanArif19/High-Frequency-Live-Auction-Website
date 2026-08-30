/**
 * client/src/App.jsx
 *
 * Root component composing AuctionCard and BidForm using the useAuction hook (TASK.md §STEP-11).
 */

import React, { useState, useEffect } from 'react';
import { useAuction } from './hooks/useAuction.js';
import { AuctionCard } from './components/AuctionCard.jsx';
import { BidForm } from './components/BidForm.jsx';

export function App() {
  // Read auctionId from query params or fallback
  const getInitialAuctionId = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('auctionId') || '';
  };

  const [auctionInput, setAuctionInput] = useState(getInitialAuctionId());
  const [activeAuctionId, setActiveAuctionId] = useState(getInitialAuctionId());

  const {
    auction,
    loading,
    error,
    wsConnected,
    bidStatus,
    priceFlash,
    placeBid,
    clearBidStatus,
  } = useAuction(activeAuctionId);

  const handleLoadAuction = (e) => {
    e.preventDefault();
    if (auctionInput.trim()) {
      const cleanId = auctionInput.trim();
      setActiveAuctionId(cleanId);
      const url = new URL(window.location);
      url.searchParams.set('auctionId', cleanId);
      window.history.pushState({}, '', url);
    }
  };

  return (
    <div className="app-container">
      {/* Background glow effects */}
      <div className="bg-glow top-left"></div>
      <div className="bg-glow bottom-right"></div>

      <header className="header">
        <div className="header-brand">
          <div className="logo-icon">⚡</div>
          <div>
            <h1 className="brand-title">High-Frequency Live Auction</h1>
            <p className="brand-subtitle">Real-time atomic bid processing engine</p>
          </div>
        </div>

        <div className="connection-status">
          <span className={`status-indicator ${wsConnected ? 'online' : 'offline'}`}></span>
          <span className="status-text">
            {wsConnected ? 'WebSocket Live' : 'Connecting Stream...'}
          </span>
        </div>
      </header>

      <main className="main-content">
        {/* Auction Lookup Bar */}
        <div className="auction-selector">
          <form onSubmit={handleLoadAuction} className="selector-form">
            <label htmlFor="auctionIdInput" className="selector-label">
              Auction ID (UUID):
            </label>
            <div className="selector-input-group">
              <input
                id="auctionIdInput"
                type="text"
                className="text-input selector-input"
                placeholder="Enter Auction UUID (e.g. 550e8400-e29b-41d4-a716-446655440000)"
                value={auctionInput}
                onChange={(e) => setAuctionInput(e.target.value)}
              />
              <button type="submit" className="load-btn">
                Load Auction
              </button>
            </div>
          </form>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="status-card loading-card">
            <div className="spinner large"></div>
            <p>Loading auction data...</p>
          </div>
        ) : error ? (
          <div className="status-card error-card">
            <span className="error-badge">Error</span>
            <p className="error-text">{error}</p>
            <p className="error-hint">Please verify the Auction ID or ensure the backend server is running.</p>
          </div>
        ) : !activeAuctionId ? (
          <div className="status-card placeholder-card">
            <div className="placeholder-icon">🏷️</div>
            <h3>No Auction Selected</h3>
            <p>Enter an active auction UUID in the search bar above to join the live bidding room.</p>
          </div>
        ) : (
          <div className="auction-grid">
            <AuctionCard
              auction={auction}
              priceFlash={priceFlash}
              wsConnected={wsConnected}
            />

            <BidForm
              auction={auction}
              bidStatus={bidStatus}
              onPlaceBid={placeBid}
              onClearStatus={clearBidStatus}
            />
          </div>
        )}
      </main>

      <footer className="footer">
        <p>
          Engine Architecture: <code>Express</code> • <code>PostgreSQL Pool</code> • <code>Redis Lua</code> • <code>RabbitMQ</code> • <code>WebSocket</code>
        </p>
      </footer>
    </div>
  );
}

export default App;
