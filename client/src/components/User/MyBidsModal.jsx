/**
 * client/src/components/User/MyBidsModal.jsx
 *
 * Modal displaying the authenticated user's bidding history across all auctions.
 */

import React, { useState, useEffect } from 'react';
import { fetchMyBids } from '../../services/auctionService.js';
import { formatINR } from '../../services/formatters.js';

export function MyBidsModal({ isOpen, onClose, onSelectAuction }) {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);

    fetchMyBids()
      .then((data) => {
        setBids(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load bidding history');
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-surface-container border border-outline-variant/40 rounded-xl shadow-2xl max-w-2xl w-full p-6 relative overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30 mb-4">
          <div>
            <h2 className="text-lg font-headline-md uppercase tracking-tight text-on-surface">
              My <span className="text-secondary">Bidding History</span>
            </h2>
            <p className="text-xs text-on-surface-variant font-mono">
              Personal verified bids placed via atomic pipeline
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {loading && (
          <div className="py-16 flex justify-center items-center">
            <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="p-3 bg-error/15 border border-error/30 rounded-lg text-xs text-error mb-4">
            {error}
          </div>
        )}

        {!loading && !error && bids.length === 0 && (
          <div className="py-16 text-center text-on-surface-variant text-sm font-mono">
            No bids recorded yet. Place an atomic bid in any live auction lot!
          </div>
        )}

        {!loading && !error && bids.length > 0 && (
          <div className="overflow-y-auto space-y-2 pr-1 flex-1">
            {bids.map((b) => {
              const isWinning = Number(b.bid_amount) >= Number(b.current_max_bid);
              return (
                <div
                  key={b.id}
                  onClick={() => {
                    if (onSelectAuction) {
                      onSelectAuction({ id: b.auction_id });
                      onClose();
                    }
                  }}
                  className="p-3 bg-surface-container-high rounded-lg border border-outline-variant/30 hover:border-secondary/40 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-on-surface hover:text-secondary transition-colors">
                      {b.item_name}
                    </span>
                    <span className="text-[11px] text-on-surface-variant font-mono mt-0.5">
                      {new Date(b.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-bold font-mono text-secondary">
                        {formatINR(b.bid_amount)}
                      </div>
                      <div className="text-[10px] font-mono uppercase">
                        {isWinning ? (
                          <span className="text-green-400 font-bold">Leading Bid</span>
                        ) : (
                          <span className="text-on-surface-variant">Outbid</span>
                        )}
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant text-lg">
                      chevron_right
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
