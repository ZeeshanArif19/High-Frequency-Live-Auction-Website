/**
 * client/src/components/BidForm.jsx
 *
 * Controlled bidding form with client-side validation and optimistic feedback (TASK.md §STEP-11).
 */

import React, { useState } from 'react';

export function BidForm({ auction, bidStatus, onPlaceBid, onClearStatus }) {
  const [bidAmount, setBidAmount] = useState('');
  const [userId, setUserId] = useState('bidder_' + Math.floor(1000 + Math.random() * 9000));
  const [validationError, setValidationError] = useState('');

  const currentMax = Number(auction?.current_max_bid ?? auction?.starting_price ?? 0);
  const isAuctionEnded = auction?.end_time ? new Date(auction.end_time).getTime() <= Date.now() : false;
  const isSubmitting = bidStatus?.state === 'pending';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');
    if (onClearStatus) onClearStatus();

    // Client-side validation: must be a positive finite decimal
    const trimmedAmount = bidAmount.trim();
    if (!trimmedAmount) {
      setValidationError('Please enter a bid amount.');
      return;
    }

    const numAmount = Number(trimmedAmount);
    if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
      setValidationError('Bid amount must be a positive finite decimal number.');
      return;
    }

    if (numAmount <= currentMax) {
      setValidationError(
        `Bid amount must be strictly greater than current maximum bid ($${currentMax.toLocaleString(undefined, { minimumFractionDigits: 2 })}).`
      );
      return;
    }

    if (!userId.trim()) {
      setValidationError('Please specify a User ID.');
      return;
    }

    await onPlaceBid({
      userId: userId.trim(),
      bidAmount: numAmount,
    });
  };

  const handleQuickIncrement = (increment) => {
    const nextAmount = Math.ceil(currentMax + increment);
    setBidAmount(String(nextAmount));
    setValidationError('');
    if (onClearStatus) onClearStatus();
  };

  return (
    <div className="bid-form-container">
      <h3 className="form-title">Place Your Bid</h3>

      <form onSubmit={handleSubmit} className="bid-form">
        <div className="form-group">
          <label htmlFor="userId" className="input-label">
            Bidder Identifier (User ID)
          </label>
          <input
            id="userId"
            type="text"
            className="text-input"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            disabled={isSubmitting || isAuctionEnded}
            placeholder="e.g. bidder_4021"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="bidAmount" className="input-label">
            Your Bid Amount ($ USD)
          </label>
          <div className="input-with-symbol">
            <span className="currency-symbol">$</span>
            <input
              id="bidAmount"
              type="number"
              step="any"
              min="0.01"
              className="text-input price-input"
              value={bidAmount}
              onChange={(e) => {
                setBidAmount(e.target.value);
                setValidationError('');
              }}
              disabled={isSubmitting || isAuctionEnded}
              placeholder={`> ${currentMax.toFixed(2)}`}
              required
            />
          </div>
        </div>

        {/* Quick increment helper buttons */}
        {!isAuctionEnded && (
          <div className="quick-buttons">
            <span className="quick-label">Quick Add:</span>
            <button
              type="button"
              className="quick-btn"
              disabled={isSubmitting}
              onClick={() => handleQuickIncrement(10)}
            >
              +$10
            </button>
            <button
              type="button"
              className="quick-btn"
              disabled={isSubmitting}
              onClick={() => handleQuickIncrement(50)}
            >
              +$50
            </button>
            <button
              type="button"
              className="quick-btn"
              disabled={isSubmitting}
              onClick={() => handleQuickIncrement(100)}
            >
              +$100
            </button>
          </div>
        )}

        {/* Validation error */}
        {validationError && (
          <div className="alert alert-danger" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{validationError}</span>
          </div>
        )}

        {/* Server status / Optimistic / Conflict feedback */}
        {bidStatus?.state === 'pending' && (
          <div className="alert alert-warning" role="status">
            <span className="spinner"></span>
            <span>{bidStatus.message || 'Bid placed — awaiting confirmation'}</span>
          </div>
        )}

        {bidStatus?.state === 'accepted' && (
          <div className="alert alert-success" role="status">
            <span className="alert-icon">✓</span>
            <span>{bidStatus.message}</span>
          </div>
        )}

        {bidStatus?.state === 'error' && (
          <div className="alert alert-danger" role="alert">
            <span className="alert-icon">✕</span>
            <span>{bidStatus.message}</span>
          </div>
        )}

        <button
          type="submit"
          className="submit-bid-btn"
          disabled={isSubmitting || isAuctionEnded}
        >
          {isAuctionEnded ? 'Auction Concluded' : isSubmitting ? 'Submitting Bid...' : 'Submit Real-Time Bid'}
        </button>
      </form>
    </div>
  );
}
