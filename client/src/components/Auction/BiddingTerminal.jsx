/**
 * client/src/components/Auction/BiddingTerminal.jsx
 *
 * Live bidding terminal connected directly to Redis Lua + PostgreSQL + RabbitMQ pipeline with WebSocket updates.
 * Enforces authentication, owner-bidding restrictions, and ownership management (AGENTS.md §7, §8).
 */

import React, { useState, useEffect } from 'react';
import { useAuction } from '../../hooks/useAuction.js';
import { formatINR, getTimeRemaining } from '../../services/formatters.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ManageAuctionModal } from './ManageAuctionModal.jsx';
import { initiateAuctionPayment } from '../../services/auctionService.js';

export function BiddingTerminal({ product, onAuctionUpdated, onAuctionDeleted }) {
  const auctionId = product?.id;
  const { user, isAuthenticated, openLogin } = useAuth();
  const {
    auction,
    bids,
    loading,
    error,
    wsConnected,
    bidStatus,
    priceFlash,
    placeBid,
    clearBidStatus,
  } = useAuction(auctionId);

  const activeAuction = auction || product;
  const currentMaxBidNumber = Number(activeAuction?.current_max_bid || activeAuction?.starting_price || 0);
  const auctionStatus = activeAuction?.status || 'UNKNOWN';
  const isScheduled = auctionStatus === 'SCHEDULED';
  const isLive = auctionStatus === 'LIVE';
  const isPostAuction = ['ENDED', 'PAYMENT_PENDING', 'SETTLED'].includes(auctionStatus);

  const [bidAmount, setBidAmount] = useState('');
  const [timeLeft, setTimeLeft] = useState(() =>
    getTimeRemaining(isScheduled ? activeAuction?.start_time : activeAuction?.end_time)
  );
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('idle');

  // Check if authenticated user is the auction owner
  const isOwner = Boolean(user && activeAuction?.owner_id && activeAuction.owner_id === user.id);
  const isWinner = Boolean(user && activeAuction?.winner_user_id === user.id);

  const handlePayment = async () => {
    setPaymentStatus('pending');
    try {
      await initiateAuctionPayment(activeAuction.id);
      setPaymentStatus('initiated');
    } catch {
      setPaymentStatus('error');
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeRemaining(isScheduled ? activeAuction?.start_time : activeAuction?.end_time));
    }, 1000);
    return () => clearInterval(timer);
  }, [activeAuction?.end_time, activeAuction?.start_time, isScheduled]);

  const handleQuickBid = (increment) => {
    if (!isAuthenticated || !isLive) {
      openLogin();
      return;
    }
    if (isOwner) return;

    const nextAmount = currentMaxBidNumber + increment;
    setBidAmount(nextAmount.toString());
    clearBidStatus();
  };

  const handlePlaceBid = async () => {
    if (!isAuthenticated || !isLive) {
      openLogin();
      return;
    }

    if (isOwner) {
      return;
    }

    const num = Number(bidAmount);
    if (!num || isNaN(num) || num <= 0) return;

    await placeBid({
      userId: user.id,
      bidAmount: num,
    });
  };

  const isEnded = timeLeft === '00:00:00' && !isScheduled;

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Countdown Terminal */}
      <div className="bg-surface-container-highest rounded-lg p-6 shadow-xl relative overflow-hidden border border-outline-variant/30">
        <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full blur-2xl -mr-16 -mt-16" />
        <div className="flex flex-col items-center justify-center text-center relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-secondary animate-pulse' : 'bg-outline'}`} />
            <p className="text-label-sm font-label-bold text-on-surface-variant tracking-widest uppercase text-xs">
              {wsConnected ? 'Live Market Feed' : 'Connecting Stream...'}
            </p>
          </div>
          <div
            className={`font-display-lg-mobile text-3xl md:text-4xl font-mono font-bold tracking-tight tabular-nums ${
              timeLeft < '00:05:00' && !isEnded ? 'text-error animate-pulse' : 'text-secondary'
            }`}
          >
            {timeLeft}
          </div>
          <p className="text-label-sm text-on-surface-variant text-[11px] mt-1">
              {isScheduled ? 'Time Until Auction Opens' : isPostAuction ? 'Auction Concluded' : 'Time Remaining to Close'}
          </p>
        </div>
      </div>

      {/* Bidding Panel */}
      <div className="bg-surface-container rounded-lg p-6 shadow-xl flex-grow flex flex-col border border-outline-variant/30 relative">
        <div className="absolute inset-0 rounded-lg shadow-[inset_0_0_20px_rgba(217,119,6,0.03)] pointer-events-none" />

        {/* Current Highest Bid */}
        <div className="mb-6 relative z-10">
          <div className="flex justify-between items-center mb-1">
            <p className="text-label-sm font-label-bold text-on-surface-variant tracking-wider uppercase">
              Current Max Bid
            </p>
            <span className="text-[11px] font-mono text-on-surface-variant">
              Starts at {formatINR(activeAuction?.starting_price)}
            </span>
          </div>
          <div
            className={`flex items-end gap-2 p-2 rounded-md transition-all duration-500 ${
              priceFlash ? 'bg-secondary/20 scale-[1.02]' : ''
            }`}
          >
            <span className="font-price-display text-3xl md:text-4xl text-on-surface tabular-nums tracking-tighter font-bold text-secondary font-mono">
              {formatINR(currentMaxBidNumber)}
            </span>
            <span className="text-body-md text-on-surface-variant mb-1 font-mono">INR</span>
          </div>
        </div>

        {/* User Identity / Ownership Banner */}
        <div className="mb-4 relative z-10">
          {isAuthenticated ? (
            <div className="p-2.5 rounded-lg bg-surface-container-high border border-outline-variant/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-secondary/20 text-secondary flex items-center justify-center text-xs font-mono font-bold">
                  {user.username.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <span className="text-xs font-bold text-on-surface font-mono block">
                    @{user.username}
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-mono">
                    {isOwner ? 'Lot Owner' : 'Verified Bidder'}
                  </span>
                </div>
              </div>

              {isOwner && (
                <button
                  onClick={() => setManageModalOpen(true)}
                  className="px-2.5 py-1 text-[11px] font-mono rounded bg-secondary/15 hover:bg-secondary/25 text-secondary border border-secondary/30 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-xs">tune</span>
                  Manage
                </button>
              )}
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-surface-container-high border border-outline-variant/40 flex items-center justify-between">
              <span className="text-xs text-on-surface-variant font-mono">Sign in to participate</span>
              <button
                onClick={openLogin}
                className="text-xs text-secondary font-bold hover:underline font-mono"
              >
                Sign In →
              </button>
            </div>
          )}
        </div>

        {/* Ownership Notice */}
        {isOwner && (
          <div className="mb-4 p-3 bg-secondary/10 border border-secondary/30 rounded-lg flex items-start gap-2 text-xs text-secondary relative z-10">
            <span className="material-symbols-outlined text-base mt-0.5">info</span>
            <span>
              <strong>Owner Listing:</strong> As the creator of this auction lot, you are restricted from bidding on your own listing.
            </span>
          </div>
        )}

        {isPostAuction && (
          <div className="mb-4 p-3 bg-surface-container-high border border-outline-variant/30 rounded-lg text-xs text-on-surface-variant relative z-10">
            <strong className="text-on-surface">{auctionStatus.replace('_', ' ')}</strong>
            {activeAuction.winner_user_id
              ? isWinner
                ? ' You are the selected winner.'
                : ' The selected winner has been notified.'
              : ' No winning bid was recorded.'}
            {auctionStatus === 'PAYMENT_PENDING' && isWinner && (
              <button
                type="button"
                onClick={handlePayment}
                disabled={paymentStatus !== 'idle'}
                className="block mt-3 bg-secondary text-on-secondary px-3 py-2 rounded font-label-bold disabled:opacity-50"
              >
                {paymentStatus === 'pending' ? 'Creating Sandbox Order...' : paymentStatus === 'initiated' ? 'Payment Order Created' : 'Initiate Payment'}
              </button>
            )}
          </div>
        )}

        {/* Quick Increment Buttons */}
        <div className="grid grid-cols-3 gap-2 mb-4 relative z-10">
          <button
            disabled={!isLive || isOwner || !isAuthenticated}
            onClick={() => handleQuickBid(100000)}
            className="bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-bold text-xs py-2.5 rounded shadow-sm border border-outline-variant/30 hover:border-secondary/50 transition-all disabled:opacity-40"
          >
            + ₹1,00,000
          </button>
          <button
            disabled={!isLive || isOwner || !isAuthenticated}
            onClick={() => handleQuickBid(500000)}
            className="bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-bold text-xs py-2.5 rounded shadow-sm border border-outline-variant/30 hover:border-secondary/50 transition-all disabled:opacity-40"
          >
            + ₹5,00,000
          </button>
          <button
            disabled={!isLive || isOwner || !isAuthenticated}
            onClick={() => handleQuickBid(1000000)}
            className="bg-surface-container-high hover:bg-surface-bright text-on-surface font-label-bold text-xs py-2.5 rounded shadow-sm border border-outline-variant/30 hover:border-secondary/50 transition-all disabled:opacity-40"
          >
            + ₹10,00,000
          </button>
        </div>

        {/* Custom Bid Input */}
        <div className="mb-6 relative z-10">
          <div className="relative flex items-center">
            <span className="absolute left-4 text-headline-sm font-headline-sm text-on-surface-variant font-bold">
              ₹
            </span>
            <input
              type="text"
              disabled={!isLive || isOwner || !isAuthenticated}
              value={bidAmount}
              onChange={(e) => {
                setBidAmount(e.target.value.replace(/[^0-9]/g, ''));
                clearBidStatus();
              }}
              placeholder={
                isOwner
                  ? 'Bidding disabled on own lot'
                  : !isAuthenticated
                  ? 'Sign in to enter bid'
                  : !isLive
                  ? `${auctionStatus.replace('_', ' ')} - bidding unavailable`
                  : `Min > ${currentMaxBidNumber.toLocaleString()}`
              }
              className="w-full bg-background border border-outline-variant text-on-surface font-headline-sm text-lg py-3.5 pl-10 pr-4 rounded-lg focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/50 shadow-inner transition-all placeholder:text-on-surface-variant/40 tabular-nums font-mono disabled:opacity-40"
            />
          </div>

          {/* Bid Status / Error Notifications */}
          {bidStatus.state === 'error' && (
            <div className="mt-2 text-xs text-error bg-error/10 border border-error/30 p-2 rounded flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">error</span>
              <span>{bidStatus.message}</span>
            </div>
          )}
          {bidStatus.state === 'pending' && (
            <div className="mt-2 text-xs text-secondary bg-secondary/10 border border-secondary/30 p-2 rounded flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
              <span>{bidStatus.message}</span>
            </div>
          )}
          {bidStatus.state === 'accepted' && (
            <div className="mt-2 text-xs text-green-400 bg-green-950/40 border border-green-700/50 p-2 rounded flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>{bidStatus.message}</span>
            </div>
          )}

          {!isAuthenticated ? (
            <button
              type="button"
              onClick={openLogin}
              className="w-full mt-3 bg-secondary text-on-secondary hover:bg-secondary/90 transition-all py-3.5 rounded-lg font-label-bold text-label-bold tracking-widest uppercase shadow-[0_0_15px_rgba(217,119,6,0.3)] hover:shadow-[0_0_25px_rgba(217,119,6,0.5)] cursor-pointer"
            >
              Sign In to Bid
            </button>
          ) : isOwner ? (
            <button
              disabled
              className="w-full mt-3 bg-surface-container-high text-on-surface-variant/60 py-3.5 rounded-lg font-label-bold text-label-bold tracking-widest uppercase cursor-not-allowed border border-outline-variant/30"
            >
              Bidding Disabled on Own Lot
            </button>
          ) : (
            <button
              disabled={!isLive || bidStatus.state === 'pending'}
              onClick={handlePlaceBid}
              className="w-full mt-3 bg-secondary text-on-secondary hover:bg-secondary/90 transition-all py-3.5 rounded-lg font-label-bold text-label-bold tracking-widest uppercase shadow-[0_0_15px_rgba(217,119,6,0.3)] hover:shadow-[0_0_25px_rgba(217,119,6,0.5)] disabled:opacity-40 cursor-pointer"
            >
              {!isLive ? `${auctionStatus.replace('_', ' ')} - Bidding Closed` : bidStatus.state === 'pending' ? 'Submitting Bid...' : 'Submit Atomic Bid'}
            </button>
          )}
        </div>

        {/* Live Bid History */}
        <div className="flex-grow flex flex-col relative z-10 border-t border-outline-variant/20 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wider text-xs">
              Live Database Bids ({bids.length})
            </h3>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              <span className="text-[11px] text-secondary font-mono">Stream Active</span>
            </div>
          </div>

          <div className="overflow-y-auto pr-1 space-y-2 max-h-52 relative">
            {bids.length === 0 ? (
              <p className="text-xs text-on-surface-variant py-4 text-center">No bids recorded yet in database.</p>
            ) : (
              bids.map((bid, idx) => {
                const isUserBid = user && bid.user_id === user.id;
                return (
                  <div
                    key={bid.id || idx}
                    className={`flex justify-between items-center p-2.5 rounded border transition-all ${
                      idx === 0
                        ? 'bg-surface-container-high border-secondary/30 shadow-sm'
                        : 'border-outline-variant/20 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-label-bold text-on-surface tracking-wider font-mono flex items-center gap-1">
                        {isUserBid ? (
                          <span className="text-secondary font-bold">You (@{user.username})</span>
                        ) : (
                          <span>{bid.user_id?.slice(0, 10) || 'Bidder'}</span>
                        )}
                        {idx === 0 && (
                          <span className="text-[10px] text-secondary font-sans font-bold">[HIGHEST]</span>
                        )}
                      </span>
                      <span className="text-[10px] text-on-surface-variant font-mono">
                        {bid.created_at ? new Date(bid.created_at).toLocaleTimeString() : 'Just now'}
                      </span>
                    </div>
                    <span className="text-sm font-label-bold text-secondary tabular-nums font-mono font-bold">
                      {formatINR(bid.bid_amount)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Owner Management Modal */}
      {isOwner && (
        <ManageAuctionModal
          isOpen={manageModalOpen}
          auction={activeAuction}
          onClose={() => setManageModalOpen(false)}
          onUpdated={(updated) => {
            if (onAuctionUpdated) onAuctionUpdated(updated);
          }}
          onDeleted={(deletedId) => {
            if (onAuctionDeleted) onAuctionDeleted(deletedId);
          }}
        />
      )}
    </div>
  );
}
