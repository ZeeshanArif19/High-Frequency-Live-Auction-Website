/**
 * client/src/components/AuctionCard.jsx
 *
 * Displays item details, live highest bid with visual flash, and countdown timer (TASK.md §STEP-11).
 */

import React, { useState, useEffect } from 'react';

function formatDuration(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function AuctionCard({ auction, priceFlash, wsConnected }) {
  const countdownTarget = auction?.status === 'SCHEDULED' ? auction?.start_time : auction?.end_time;
  const [timeLeft, setTimeLeft] = useState(() => {
    if (!countdownTarget) return 0;
    return new Date(countdownTarget).getTime() - Date.now();
  });

  useEffect(() => {
    if (!countdownTarget) return;

    const interval = setInterval(() => {
      const remaining = new Date(countdownTarget).getTime() - Date.now();
      setTimeLeft(Math.max(0, remaining));
    }, 1000);

    return () => clearInterval(interval);
  }, [countdownTarget]);

  if (!auction) {
    return (
      <div className="auction-card empty-state">
        <p>No auction data available.</p>
      </div>
    );
  }

  const status = auction.status || (timeLeft <= 0 ? 'ENDED' : 'LIVE');
  const isScheduled = status === 'SCHEDULED';
  const isEnded = ['ENDED', 'PAYMENT_PENDING', 'SETTLED'].includes(status);
  const currentMaxBid = Number(auction.current_max_bid ?? auction.starting_price ?? 0);
  const startingPrice = Number(auction.starting_price ?? 0);

  return (
    <div className={`auction-card ${isEnded ? 'auction-ended' : 'auction-active'}`}>
      <div className="card-header">
        <div className="status-tags">
          <span className={`badge ${isEnded ? 'badge-ended' : 'badge-live'}`}>
            <span className="pulse-dot"></span>
            {status.replace('_', ' ')}
          </span>
          <span className={`ws-badge ${wsConnected ? 'ws-online' : 'ws-offline'}`}>
            {wsConnected ? '⚡ Real-time Stream' : 'Connecting stream...'}
          </span>
        </div>
        <span className="auction-id">ID: {auction.id.slice(0, 8)}...</span>
      </div>

      <h2 className="item-name">{auction.item_name}</h2>

      <div className="metrics-grid">
        <div className={`metric-box primary ${priceFlash ? 'flash-update' : ''}`}>
          <span className="metric-label">CURRENT HIGHEST BID</span>
          <span className="metric-value bid-highlight">
            ${currentMaxBid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="metric-sub">
            Starting Price: ${startingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="metric-box countdown-box">
          <span className="metric-label">TIME REMAINING</span>
          <span className={`metric-value timer-display ${timeLeft < 60000 && !isEnded ? 'timer-urgent' : ''}`}>
            {isEnded ? '00:00:00' : formatDuration(timeLeft)}
          </span>
          <span className="metric-sub">
            {isScheduled
              ? `Opens: ${new Date(auction.start_time).toLocaleTimeString()}`
              : isEnded
              ? 'Bidding is closed'
              : `Ends: ${new Date(auction.end_time).toLocaleTimeString()}`}
          </span>
        </div>
      </div>
    </div>
  );
}
