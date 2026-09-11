/**
 * client/src/components/Auction/ManageAuctionModal.jsx
 *
 * Modal allowing the owner of an auction to edit or delete it.
 * Respects lifecycle constraints:
 *  - Bidding parameters are read-only once auction is LIVE.
 *  - Deletion/cancellation is blocked if bids have been placed.
 */

import React, { useState, useMemo } from 'react';
import { updateAuction, deleteAuction } from '../../services/auctionService.js';

const CATEGORIES = ['Horology', 'Automotive', 'Digital Asset', 'Fine Art', 'Collectibles'];

function toLocalInputValue(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function ManageAuctionModal({ isOpen, auction, onClose, onUpdated, onDeleted }) {
  const [title, setTitle] = useState(auction?.title || auction?.item_name || '');
  const [category, setCategory] = useState(auction?.category || 'Horology');
  const [imageUrl, setImageUrl] = useState(auction?.image_url || '');
  const [lotNumber, setLotNumber] = useState(auction?.lot_number || '');
  const [description, setDescription] = useState(auction?.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Lifecycle state computation
  const { isLive, isEnded, hasBids, canDelete, canEditBiddingFields } = useMemo(() => {
    if (!auction) return { isLive: false, isEnded: false, hasBids: false, canDelete: true, canEditBiddingFields: true };
    if (auction.status) {
      const hasBids = (auction.bid_count ?? 0) > 0;
      return {
        isLive: auction.status === 'LIVE',
        isEnded: ['ENDED', 'PAYMENT_PENDING', 'SETTLED'].includes(auction.status),
        hasBids,
        canDelete: auction.status === 'SCHEDULED' && !hasBids,
        canEditBiddingFields: auction.status === 'SCHEDULED' && !hasBids,
      };
    }

    const now = Date.now();
    const startMs = new Date(auction.start_time).getTime();
    const endMs = new Date(auction.end_time).getTime();
    const live = now >= startMs && now < endMs;
    const ended = now >= endMs;
    const bids = (auction.bid_count ?? 0) > 0;
    return {
      isLive: live,
      isEnded: ended,
      hasBids: bids,
      canDelete: !bids,
      canEditBiddingFields: !live && !ended && !bids,
    };
  }, [auction]);

  if (!isOpen || !auction) return null;

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title cannot be empty.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const updated = await updateAuction(auction.id, {
        title: title.trim(),
        category: category.trim(),
        imageUrl: imageUrl.trim() || null,
        lotNumber: lotNumber.trim() || null,
        description: description.trim() || null,
      });

      setLoading(false);
      if (onUpdated) onUpdated(updated);
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to update auction lot.');
    }
  };

  const handleDelete = async () => {
    setError(null);
    setLoading(true);

    try {
      await deleteAuction(auction.id);
      setLoading(false);
      if (onDeleted) onDeleted(auction.id);
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to delete auction lot.');
    }
  };

  const lifecycleBadge = isEnded
    ? { label: 'CONCLUDED', cls: 'bg-outline/20 text-on-surface-variant border-outline/30' }
    : isLive
    ? { label: 'LIVE', cls: 'bg-secondary/15 text-secondary border-secondary/30' }
    : hasBids
    ? { label: 'SCHEDULED – BIDS PLACED', cls: 'bg-error/10 text-error border-error/30' }
    : { label: 'SCHEDULED', cls: 'bg-surface-container-highest text-on-surface-variant border-outline-variant/30' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-surface-container border border-outline-variant/40 rounded-xl shadow-2xl max-w-lg w-full p-6 relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30 mb-4">
          <div>
            <h2 className="text-lg font-headline-md uppercase tracking-tight text-on-surface">
              Manage <span className="text-secondary">Auction Lot</span>
            </h2>
            <p className="text-xs text-on-surface-variant font-mono">
              Owner controls · Lot #{auction.lot_number || auction.id.slice(0, 8)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Lifecycle status badge */}
        <div className={`mb-4 px-3 py-2 border rounded-lg flex items-center gap-2 text-xs font-mono font-bold ${lifecycleBadge.cls}`}>
          <span className="material-symbols-outlined text-sm">
            {isEnded ? 'check_circle' : isLive ? 'radio_button_checked' : 'schedule'}
          </span>
          <span>{lifecycleBadge.label}</span>
          {hasBids && !isEnded && (
            <span className="ml-auto text-[10px] font-normal">
              {auction.bid_count} bid{auction.bid_count !== 1 ? 's' : ''} placed
            </span>
          )}
        </div>

        {/* LIVE / concluded notice */}
        {(isLive || isEnded) && (
          <div className="mb-4 p-3 bg-secondary/8 border border-secondary/20 rounded-lg text-xs text-on-surface-variant">
            {isEnded
              ? 'This auction has concluded. Only cosmetic details can be updated.'
              : 'Auction is LIVE. Only cosmetic details (title, description, category, image) can be updated. Bidding parameters are locked.'}
          </div>
        )}

        {/* Bids placed notice (not live, but has bids) */}
        {!isLive && !isEnded && hasBids && (
          <div className="mb-4 p-3 bg-error/8 border border-error/20 rounded-lg text-xs text-error">
            Bids have already been placed. Bidding parameters cannot be modified and the auction cannot be deleted.
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-error/15 border border-error/30 rounded-lg flex items-center gap-2 text-xs text-error">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleUpdate} className="overflow-y-auto space-y-4 pr-1 flex-1">
          {/* Title */}
          <div>
            <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Lot Title / Item Name
            </label>
            <input
              id="manage-auction-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isEnded}
              className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary disabled:opacity-50"
            />
          </div>

          {/* Category & Lot # */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                id="manage-auction-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={isEnded}
                className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary disabled:opacity-50"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Lot #
              </label>
              <input
                id="manage-auction-lot-number"
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                disabled={isEnded}
                className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary font-mono disabled:opacity-50"
              />
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Image URL
            </label>
            <input
              id="manage-auction-image-url"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={isEnded}
              className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary font-mono disabled:opacity-50"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              id="manage-auction-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isEnded}
              className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary resize-none disabled:opacity-50"
            />
          </div>

          {/* Read-only bidding fields when LIVE/bids placed */}
          {!canEditBiddingFields && (
            <div className="p-3 bg-surface-container-highest border border-outline-variant/30 rounded-lg space-y-2">
              <p className="text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-2">
                Bidding Parameters (Locked)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-on-surface-variant font-mono uppercase">Starting Price</p>
                  <p className="text-sm font-mono font-bold text-on-surface">
                    ₹{Number(auction.starting_price).toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant font-mono uppercase">Min Increment</p>
                  <p className="text-sm font-mono font-bold text-on-surface">
                    ₹{Number(auction.minimum_bid_increment).toLocaleString('en-IN')}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant font-mono uppercase">Start Time</p>
                  <p className="text-xs font-mono text-on-surface">
                    {auction.start_time ? new Date(auction.start_time).toLocaleString() : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant font-mono uppercase">End Time</p>
                  <p className="text-xs font-mono text-on-surface">
                    {auction.end_time ? new Date(auction.end_time).toLocaleString() : '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 flex flex-col gap-3">
            {!isEnded && (
              <button
                id="manage-auction-save"
                type="submit"
                disabled={loading}
                className="w-full bg-secondary text-on-secondary hover:bg-secondary/90 py-2.5 rounded-lg font-label-bold text-xs uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Modifications'}
              </button>
            )}

            {canDelete ? (
              !confirmDelete ? (
                <button
                  id="manage-auction-delete"
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full bg-error/10 hover:bg-error/20 text-error border border-error/30 py-2.5 rounded-lg font-label-bold text-xs uppercase tracking-widest transition-all cursor-pointer"
                >
                  Delete Auction Lot
                </button>
              ) : (
                <div className="p-3 bg-error/15 border border-error/40 rounded-lg flex flex-col gap-2">
                  <p className="text-xs text-error font-bold">Are you sure? This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button
                      id="manage-auction-confirm-delete"
                      type="button"
                      disabled={loading}
                      onClick={handleDelete}
                      className="flex-1 bg-error text-white py-1.5 rounded text-xs font-bold hover:bg-error/90 cursor-pointer"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 bg-surface-container-high text-on-surface py-1.5 rounded text-xs hover:bg-surface-bright cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="p-2.5 bg-error/6 border border-error/20 rounded-lg text-xs text-error/70 text-center font-mono">
                Deletion locked — bids have been placed on this auction.
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
