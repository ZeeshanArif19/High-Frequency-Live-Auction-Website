/**
 * client/src/hooks/useAuction.js
 *
 * Custom hook combining auctionService and wsService to maintain live auction state,
 * price flash animations, bid placement, and live bid history (AGENTS.md §7).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAuction, fetchAuctionBids, placeBid } from '../services/auctionService.js';
import { wsService } from '../services/wsService.js';

export function useAuction(auctionId) {
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [bidStatus, setBidStatus] = useState({ state: 'idle', message: null });
  const [priceFlash, setPriceFlash] = useState(false);
  const flashTimeoutRef = useRef(null);

  // Load initial auction data and bid history
  useEffect(() => {
    if (!auctionId) {
      setLoading(false);
      setAuction(null);
      setBids([]);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    setBidStatus({ state: 'idle', message: null });

    Promise.all([
      fetchAuction(auctionId),
      fetchAuctionBids(auctionId).catch(() => []),
    ])
      .then(([auctionData, bidsData]) => {
        if (isMounted) {
          setAuction(auctionData);
          setBids(bidsData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load auction');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [auctionId]);

  // Connect WebSocket and listen for real-time bid updates
  useEffect(() => {
    wsService.connect();

    const unsubConn = wsService.on('connectionChange', ({ connected }) => {
      setWsConnected(connected);
    });

    setWsConnected(wsService.isConnected);

    if (!auctionId) return unsubConn;

    const unsubBid = wsService.on(`bidUpdate:${auctionId}`, (payload) => {
      const { newMaxBid, timestamp } = payload;
      setAuction((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          current_max_bid: newMaxBid,
        };
      });

      // Refetch latest bids to keep history in sync
      fetchAuctionBids(auctionId)
        .then((latestBids) => setBids(latestBids))
        .catch(() => {});

      // Visual flash animation trigger
      setPriceFlash(true);
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
      flashTimeoutRef.current = setTimeout(() => {
        setPriceFlash(false);
      }, 1200);

      // If user had an optimistic pending state, confirm it
      setBidStatus((prev) => {
        if (prev.state === 'pending') {
          return {
            state: 'accepted',
            message: `Confirmed! Current highest bid is now ₹${Number(newMaxBid).toLocaleString()}`,
          };
        }
        return prev;
      });
    });

    return () => {
      unsubConn();
      unsubBid();
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
    };
  }, [auctionId]);

  // Submit bid action
  const handlePlaceBid = useCallback(
    async ({ userId, bidAmount }) => {
      if (!auctionId) {
        setBidStatus({ state: 'error', message: 'No active auction selected.' });
        return { success: false };
      }

      const numBid = Number(bidAmount);
      if (isNaN(numBid) || !isFinite(numBid) || numBid <= 0) {
        setBidStatus({ state: 'error', message: 'Bid amount must be a positive finite decimal.' });
        return { success: false };
      }

      const currentMax = Number(auction?.current_max_bid ?? auction?.starting_price ?? 0);
      if (numBid <= currentMax) {
        setBidStatus({
          state: 'error',
          message: `Bid must be higher than current highest bid (₹${currentMax.toLocaleString()}).`,
        });
        return { success: false };
      }

      setBidStatus({
        state: 'pending',
        message: 'Bid placed — awaiting confirmation...',
      });

      try {
        const result = await placeBid(auctionId, { userId, bidAmount: numBid });

        if (result.accepted) {
          return { success: true };
        } else {
          const errorMessage = result.error || 'Bid rejected: Outbid by another bidder or auction ended.';
          setBidStatus({
            state: 'error',
            message: errorMessage,
          });
          return { success: false, error: errorMessage };
        }
      } catch (err) {
        const errorMsg = err.message || 'Network error submitting bid.';
        setBidStatus({
          state: 'error',
          message: errorMsg,
        });
        return { success: false, error: errorMsg };
      }
    },
    [auctionId, auction]
  );

  const clearBidStatus = useCallback(() => {
    setBidStatus({ state: 'idle', message: null });
  }, []);

  return {
    auction,
    bids,
    loading,
    error,
    wsConnected,
    bidStatus,
    priceFlash,
    placeBid: handlePlaceBid,
    clearBidStatus,
  };
}
