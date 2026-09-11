/**
 * client/src/components/Auction/ManageAuctionModal.jsx
 *
 * Modal allowing the owner of an auction to edit or delete it.
 */

import React, { useState } from 'react';
import { updateAuction, deleteAuction } from '../../services/auctionService.js';

export function ManageAuctionModal({ isOpen, auction, onClose, onUpdated, onDeleted }) {
  const [itemName, setItemName] = useState(auction?.item_name || '');
  const [category, setCategory] = useState(auction?.category || 'Horology');
  const [imageUrl, setImageUrl] = useState(auction?.image_url || '');
  const [lotNumber, setLotNumber] = useState(auction?.lot_number || '');
  const [description, setDescription] = useState(auction?.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen || !auction) return null;

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const updated = await updateAuction(auction.id, {
        item_name: itemName.trim(),
        category: category.trim(),
        image_url: imageUrl.trim() || null,
        lot_number: lotNumber.trim() || null,
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
              Owner controls for Lot #{auction.lot_number || auction.id.slice(0, 8)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-error/15 border border-error/30 rounded-lg flex items-center gap-2 text-xs text-error">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleUpdate} className="overflow-y-auto space-y-4 pr-1 flex-1">
          <div>
            <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Lot Title / Item Name
            </label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary"
              >
                <option value="Horology">Horology</option>
                <option value="Automotive">Automotive</option>
                <option value="Digital Asset">Digital Asset</option>
                <option value="Fine Art">Fine Art</option>
                <option value="Collectibles">Collectibles</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Lot #
              </label>
              <input
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Image URL
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary resize-none"
            />
          </div>

          <div className="pt-2 flex flex-col gap-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-secondary text-on-secondary hover:bg-secondary/90 py-2.5 rounded-lg font-label-bold text-xs uppercase tracking-widest transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Modifications'}
            </button>

            {!confirmDelete ? (
              <button
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
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
