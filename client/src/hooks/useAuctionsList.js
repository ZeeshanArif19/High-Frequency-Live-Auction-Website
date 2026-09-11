/**
 * client/src/hooks/useAuctionsList.js
 *
 * Hook to fetch and maintain live list of auctions from the database with real-time WebSocket updates.
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchAuctions } from '../services/auctionService.js';
import { wsService } from '../services/wsService.js';

export function useAuctionsList() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAuctions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAuctions();
      setAuctions(data);
    } catch (err) {
      console.error('[useAuctionsList] Error loading auctions:', err);
      setError(err.message || 'Failed to load auctions from database');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuctions();
  }, [loadAuctions]);

  // Listen for WebSocket bid updates across all auctions
  useEffect(() => {
    wsService.connect();

    const unsubBid = wsService.on('bidUpdate', (payload) => {
      const { auctionId, newMaxBid } = payload;
      if (!auctionId || newMaxBid === undefined) return;

      setAuctions((prevList) =>
        prevList.map((auc) => {
          if (auc.id === auctionId) {
            return {
              ...auc,
              current_max_bid: newMaxBid,
            };
          }
          return auc;
        })
      );
    });

    return () => {
      unsubBid();
    };
  }, []);

  return {
    auctions,
    loading,
    error,
    refresh: loadAuctions,
  };
}
