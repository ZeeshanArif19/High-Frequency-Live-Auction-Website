/**
 * client/src/components/User/MyAuctionsPage.jsx
 *
 * Page listing all auctions created by the authenticated user.
 * Shows lifecycle status, bid count, and allows navigation to auction detail
 * or opening the ManageAuctionModal (edit/delete).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { fetchMyAuctions, fetchAuction } from '../../services/auctionService.js';
import { ManageAuctionModal } from '../Auction/ManageAuctionModal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatINR } from '../../services/formatters.js';

function getLifecycleStatus(auction) {
  if (auction.status) return auction.status;
  const now = Date.now();
  const startMs = new Date(auction.start_time).getTime();
  const endMs = new Date(auction.end_time).getTime();
  if (now >= endMs) return 'ENDED';
  if (now >= startMs) return 'LIVE';
  return 'SCHEDULED';
}

function LifecyclePill({ status }) {
  const cfg = {
    LIVE: 'bg-secondary/15 text-secondary border-secondary/40',
    SCHEDULED: 'bg-surface-container-highest text-on-surface-variant border-outline-variant/40',
    ENDED: 'bg-outline/15 text-on-surface-variant border-outline/20',
    PAYMENT_PENDING: 'bg-error/10 text-error border-error/30',
    SETTLED: 'bg-green-400/10 text-green-400 border-green-400/30',
  };
  const icon = {
    LIVE: 'radio_button_checked',
    SCHEDULED: 'schedule',
    ENDED: 'check_circle',
    PAYMENT_PENDING: 'payments',
    SETTLED: 'verified',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${cfg[status]}`}
    >
      <span className="material-symbols-outlined text-[11px]">{icon[status]}</span>
      {status}
    </span>
  );
}

export function MyAuctionsPage({ onNavigateBack, onAuctionSelect }) {
  const { openCreateAuction } = useAuth();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [manageTarget, setManageTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyAuctions();
      setAuctions(data);
    } catch (err) {
      setError(err.message || 'Failed to load your auctions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAuctionUpdated = (updated) => {
    setAuctions((prev) =>
      prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
    );
    setManageTarget(null);
  };

  const handleAuctionDeleted = (deletedId) => {
    setAuctions((prev) => prev.filter((a) => a.id !== deletedId));
    setManageTarget(null);
  };

  const handleSelectAuction = async (id) => {
    try {
      const full = await fetchAuction(id);
      if (onAuctionSelect) onAuctionSelect(full);
    } catch {
      // silently ignore
    }
  };

  return (
    <div className="min-h-screen flex flex-col w-full bg-surface text-on-surface">
      {/* Header bar */}
      <header className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_12px_rgba(0,0,0,0.3)] border-b border-outline-variant/30">
        <div className="h-20 w-full px-8 md:px-16 flex items-center justify-between max-w-[1440px] mx-auto">
          <div className="flex items-center gap-4">
            <button
              onClick={onNavigateBack}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors group cursor-pointer"
              title="Go back"
            >
              <span
                className="material-symbols-outlined text-on-surface group-hover:text-secondary transition-colors"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                arrow_back
              </span>
            </button>
            <span className="font-headline-md text-headline-md tracking-tight uppercase text-on-surface">
              BidStream
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openCreateAuction}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-secondary/15 hover:bg-secondary/25 text-xs font-mono text-secondary border border-secondary/40 transition-colors font-bold cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              <span>New Lot</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="w-full pt-28 pb-16 flex-1">
        <div className="max-w-5xl mx-auto px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-headline-md uppercase tracking-tight text-on-surface">
              My <span className="text-secondary">Auction Lots</span>
            </h1>
            <p className="text-sm text-on-surface-variant font-mono mt-1">
              Manage your listed auction lots — edit details, track bids, or cancel.
            </p>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-24">
              <span className="material-symbols-outlined text-4xl text-secondary animate-spin">refresh</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-error/15 border border-error/30 rounded-lg flex items-center gap-2 text-sm text-error mb-6">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && auctions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant">gavel</span>
              <p className="text-on-surface-variant font-mono text-sm">
                You haven't listed any auction lots yet.
              </p>
              <button
                onClick={openCreateAuction}
                className="mt-2 px-6 py-3 bg-secondary text-on-secondary rounded-lg text-xs font-label-bold uppercase tracking-widest hover:bg-secondary/90 transition-all shadow-[0_0_15px_rgba(217,119,6,0.3)] cursor-pointer"
              >
                List Your First Lot
              </button>
            </div>
          )}

          {!loading && auctions.length > 0 && (
            <div className="space-y-4">
              {auctions.map((auction) => {
                const status = getLifecycleStatus(auction);
                const bidCount = auction.bid_count ?? 0;

                return (
                  <div
                    key={auction.id}
                    className="bg-surface-container border border-outline-variant/30 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-secondary/30 transition-all"
                  >
                    {/* Image thumbnail */}
                    {auction.image_url && (
                      <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-surface-container-high">
                        <img
                          src={auction.image_url}
                          alt={auction.title || auction.item_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-bold text-on-surface font-mono truncate">
                          {auction.title || auction.item_name}
                        </h3>
                        <LifecyclePill status={status} />
                        {auction.category && (
                          <span className="text-[10px] text-on-surface-variant border border-outline-variant/30 px-1.5 py-0.5 rounded-full font-mono">
                            {auction.category}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs font-mono text-on-surface-variant mt-1">
                        <span>
                          Start:{' '}
                          <span className="text-on-surface">
                            {new Date(auction.start_time).toLocaleString()}
                          </span>
                        </span>
                        <span>
                          End:{' '}
                          <span className="text-on-surface">
                            {new Date(auction.end_time).toLocaleString()}
                          </span>
                        </span>
                        <span>
                          Reserve:{' '}
                          <span className="text-secondary font-bold">
                            {formatINR(auction.starting_price)}
                          </span>
                        </span>
                        <span>
                          Current Max:{' '}
                          <span className="text-secondary font-bold">
                            {formatINR(auction.current_max_bid)}
                          </span>
                        </span>
                        <span>
                          Bids:{' '}
                          <span className={bidCount > 0 ? 'text-secondary font-bold' : 'text-on-surface'}>
                            {bidCount}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleSelectAuction(auction.id)}
                        className="px-3 py-1.5 text-xs font-mono rounded-lg bg-surface-container-high hover:bg-surface-bright border border-outline-variant/40 text-on-surface transition-colors flex items-center gap-1 cursor-pointer"
                        title="View auction"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        <span>View</span>
                      </button>
                      {!auction.is_ended && (
                        <button
                          onClick={() => setManageTarget(auction)}
                          className="px-3 py-1.5 text-xs font-mono rounded-lg bg-secondary/10 hover:bg-secondary/20 border border-secondary/30 text-secondary transition-colors flex items-center gap-1 cursor-pointer"
                          title="Manage auction"
                        >
                          <span className="material-symbols-outlined text-sm">tune</span>
                          <span>Manage</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Manage Modal */}
      {manageTarget && (
        <ManageAuctionModal
          isOpen={Boolean(manageTarget)}
          auction={manageTarget}
          onClose={() => setManageTarget(null)}
          onUpdated={handleAuctionUpdated}
          onDeleted={handleAuctionDeleted}
        />
      )}
    </div>
  );
}
