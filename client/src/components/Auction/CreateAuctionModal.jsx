/**
 * client/src/components/Auction/CreateAuctionModal.jsx
 *
 * Modal allowing authenticated users to list a new auction lot.
 */

import React, { useState } from 'react';
import { createAuction } from '../../services/auctionService.js';

export function CreateAuctionModal({ isOpen, onClose, onAuctionCreated }) {
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Horology');
  const [startingPrice, setStartingPrice] = useState('');
  const [durationHours, setDurationHours] = useState('4');
  const [imageUrl, setImageUrl] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const priceNum = Number(startingPrice);
    if (!priceNum || priceNum <= 0) {
      setError('Starting price must be greater than 0.');
      setLoading(false);
      return;
    }

    const hours = Number(durationHours) || 2;
    const endTime = new Date(Date.now() + hours * 3600000).toISOString();

    try {
      const newAuction = await createAuction({
        item_name: itemName.trim(),
        category: category.trim(),
        starting_price: priceNum,
        end_time: endTime,
        image_url: imageUrl.trim() || null,
        lot_number: lotNumber.trim() || null,
        description: description.trim() || null,
      });

      setLoading(false);
      if (onAuctionCreated) onAuctionCreated(newAuction);
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to create auction lot');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-surface-container border border-outline-variant/40 rounded-xl shadow-2xl max-w-lg w-full p-6 relative overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30 mb-4">
          <div>
            <h2 className="text-lg font-headline-md uppercase tracking-tight text-on-surface">
              List New <span className="text-secondary">Auction Lot</span>
            </h2>
            <p className="text-xs text-on-surface-variant font-mono">
              Live Redis atomic engine registration
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Error alert */}
        {error && (
          <div className="mb-4 p-3 bg-error/15 border border-error/30 rounded-lg flex items-center gap-2 text-xs text-error">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto space-y-4 pr-1 flex-1">
          <div>
            <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Lot Title / Item Name *
            </label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. 1974 Porsche 911 Carrera RS"
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
                Lot # (Optional)
              </label>
              <input
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="e.g. 709"
                className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Starting Price (₹) *
              </label>
              <input
                type="number"
                required
                min="1"
                step="any"
                value={startingPrice}
                onChange={(e) => setStartingPrice(e.target.value)}
                placeholder="1000000"
                className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Duration (Hours)
              </label>
              <input
                type="number"
                min="1"
                max="168"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Image URL (Optional)
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Description / Provenance
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed condition, provenance, and specifications..."
              className="w-full bg-surface-container-high border border-outline-variant/50 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary resize-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-secondary text-on-secondary hover:bg-secondary/90 py-3 rounded-lg font-label-bold text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(217,119,6,0.3)] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading && <span className="material-symbols-outlined text-sm animate-spin">refresh</span>}
              <span>{loading ? 'Creating Auction...' : 'Publish Live Auction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
