/**
 * client/src/components/Auction/CreateAuctionModal.jsx
 *
 * Modal allowing authenticated users to list a new auction lot.
 * All required fields: title, description, startingPrice, minimumBidIncrement, startTime, endTime.
 */

import React, { useState } from 'react';
import { createAuction } from '../../services/auctionService.js';

const CATEGORIES = ['Horology', 'Automotive', 'Digital Asset', 'Fine Art', 'Collectibles'];

function getDefaultStartTime() {
  const d = new Date(Date.now() + 5 * 60000); // 5 minutes from now
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

function getDefaultEndTime() {
  const d = new Date(Date.now() + 4 * 3600000); // 4 hours from now
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export function CreateAuctionModal({ isOpen, onClose, onAuctionCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Horology');
  const [startingPrice, setStartingPrice] = useState('');
  const [minimumBidIncrement, setMinimumBidIncrement] = useState('');
  const [startTime, setStartTime] = useState(getDefaultStartTime);
  const [endTime, setEndTime] = useState(getDefaultEndTime);
  const [imageUrl, setImageUrl] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};

    if (!title.trim()) errs.title = 'Title is required.';
    if (!description.trim()) errs.description = 'Description is required.';

    const priceNum = Number(startingPrice);
    if (!startingPrice || isNaN(priceNum) || priceNum <= 0)
      errs.startingPrice = 'Starting price must be a positive number.';

    const incrNum = Number(minimumBidIncrement);
    if (!minimumBidIncrement || isNaN(incrNum) || incrNum <= 0)
      errs.minimumBidIncrement = 'Minimum bid increment must be a positive number.';

    if (!startTime) {
      errs.startTime = 'Start time is required.';
    }
    if (!endTime) {
      errs.endTime = 'End time is required.';
    }
    if (startTime && endTime) {
      if (new Date(startTime).getTime() >= new Date(endTime).getTime()) {
        errs.startTime = 'Start time must be before end time.';
      }
    }

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const newAuction = await createAuction({
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        startingPrice: Number(startingPrice),
        minimumBidIncrement: Number(minimumBidIncrement),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        imageUrl: imageUrl.trim() || null,
        lotNumber: lotNumber.trim() || null,
      });

      setLoading(false);
      if (onAuctionCreated) onAuctionCreated(newAuction);
      onClose();

      // Reset form
      setTitle('');
      setDescription('');
      setCategory('Horology');
      setStartingPrice('');
      setMinimumBidIncrement('');
      setStartTime(getDefaultStartTime());
      setEndTime(getDefaultEndTime());
      setImageUrl('');
      setLotNumber('');
    } catch (err) {
      setLoading(false);
      setErrors({ form: err.message || 'Failed to create auction lot.' });
    }
  };

  const fieldCls = (hasErr) =>
    `w-full bg-surface-container-high border ${
      hasErr ? 'border-error/60' : 'border-outline-variant/50'
    } rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-secondary transition-colors`;

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
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Form-level error */}
        {errors.form && (
          <div className="mb-4 p-3 bg-error/15 border border-error/30 rounded-lg flex items-center gap-2 text-xs text-error">
            <span className="material-symbols-outlined text-sm">error</span>
            <span>{errors.form}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="overflow-y-auto space-y-4 pr-1 flex-1">

          {/* Title */}
          <div>
            <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Lot Title *
            </label>
            <input
              id="create-auction-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 1974 Porsche 911 Carrera RS"
              className={fieldCls(errors.title)}
            />
            {errors.title && <p className="text-xs text-error mt-1">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Description / Provenance *
            </label>
            <textarea
              id="create-auction-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed condition, provenance, and specifications..."
              className={`${fieldCls(errors.description)} resize-none`}
            />
            {errors.description && <p className="text-xs text-error mt-1">{errors.description}</p>}
          </div>

          {/* Category & Lot # */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                id="create-auction-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={fieldCls(false)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Lot # (Optional)
              </label>
              <input
                id="create-auction-lot-number"
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="e.g. 709"
                className={`${fieldCls(false)} font-mono`}
              />
            </div>
          </div>

          {/* Starting Price & Minimum Bid Increment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Starting Price (₹) *
              </label>
              <input
                id="create-auction-starting-price"
                type="number"
                min="1"
                step="any"
                value={startingPrice}
                onChange={(e) => setStartingPrice(e.target.value)}
                placeholder="1000000"
                className={`${fieldCls(errors.startingPrice)} font-mono`}
              />
              {errors.startingPrice && <p className="text-xs text-error mt-1">{errors.startingPrice}</p>}
            </div>
            <div>
              <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Min Bid Increment (₹) *
              </label>
              <input
                id="create-auction-min-increment"
                type="number"
                min="1"
                step="any"
                value={minimumBidIncrement}
                onChange={(e) => setMinimumBidIncrement(e.target.value)}
                placeholder="10000"
                className={`${fieldCls(errors.minimumBidIncrement)} font-mono`}
              />
              {errors.minimumBidIncrement && (
                <p className="text-xs text-error mt-1">{errors.minimumBidIncrement}</p>
              )}
            </div>
          </div>

          {/* Start Time & End Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
                Start Time *
              </label>
              <input
                id="create-auction-start-time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={`${fieldCls(errors.startTime)} font-mono`}
              />
              {errors.startTime && <p className="text-xs text-error mt-1">{errors.startTime}</p>}
            </div>
            <div>
              <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
                End Time *
              </label>
              <input
                id="create-auction-end-time"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={`${fieldCls(errors.endTime)} font-mono`}
              />
              {errors.endTime && <p className="text-xs text-error mt-1">{errors.endTime}</p>}
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-xs font-label-bold text-on-surface-variant uppercase tracking-wider mb-1">
              Image URL (Optional)
            </label>
            <input
              id="create-auction-image-url"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className={`${fieldCls(false)} font-mono`}
            />
          </div>

          <div className="pt-2">
            <button
              id="create-auction-submit"
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
