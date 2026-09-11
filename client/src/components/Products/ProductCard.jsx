/**
 * client/src/components/Products/ProductCard.jsx
 *
 * Individual product card for the products grid using live database auction data.
 */

import React, { useState, useEffect } from 'react';
import { formatINR, getTimeRemaining } from '../../services/formatters.js';

export function ProductCard({ product, onEnterAuction }) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeRemaining(product.end_time));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeRemaining(product.end_time));
    }, 1000);
    return () => clearInterval(timer);
  }, [product.end_time]);

  const isEnded = timeLeft === '00:00:00';
  const currentPrice = formatINR(product.current_max_bid || product.starting_price);

  return (
    <article className="bg-surface-container rounded-lg overflow-hidden group hover:bg-surface-container-high transition-all duration-300 shadow-md hover:shadow-xl hover:shadow-black/60 relative border border-outline-variant/30 flex flex-col justify-between">
      <div>
        {/* Status Badge */}
        <div className="absolute top-4 left-4 z-20 bg-surface/90 backdrop-blur-sm px-3 py-1 rounded-sm flex items-center gap-2 border border-outline-variant/50 shadow-md">
          <span className={`w-2 h-2 rounded-full ${isEnded ? 'bg-outline' : 'bg-secondary animate-pulse'}`} />
          <span className="font-label-bold text-label-bold text-on-surface uppercase tracking-wider text-[10px]">
            {isEnded ? 'Ended' : 'Live Auction'}
          </span>
        </div>

        {/* Lot Number */}
        {product.lot_number && (
          <div className="absolute top-4 right-4 z-20 bg-surface/80 backdrop-blur-md px-2 py-1 rounded-sm font-mono text-[10px] text-on-surface-variant border border-outline-variant">
            LOT #{product.lot_number}
          </div>
        )}

        {/* Image Container */}
        <div className="relative h-64 w-full overflow-hidden bg-surface-container-highest">
          <img
            alt={product.item_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-in-out opacity-90 group-hover:opacity-100 mix-blend-lighten"
            src={product.image_url}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-transparent to-transparent" />
        </div>

        {/* Content Section */}
        <div className="p-6 flex flex-col gap-4">
          <div>
            <p className="font-label-sm text-label-sm text-secondary uppercase tracking-widest mb-1">
              {product.category || 'Exchange Lot'}
            </p>
            <h3 className="font-headline-sm text-headline-sm text-on-surface line-clamp-1 font-bold">
              {product.item_name}
            </h3>
            <p className="font-body-md text-[13px] text-on-surface-variant line-clamp-2 mt-2 leading-relaxed">
              {product.description || 'Rare collectible authenticated and certified for exchange.'}
            </p>
          </div>

          {/* Bid Info Box */}
          <div className="bg-surface-container-highest rounded-lg p-3 flex justify-between items-center border border-outline-variant/30">
            <div className="flex flex-col">
              <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">
                Current Max Bid
              </span>
              <span className="font-price-display text-headline-sm text-secondary tracking-tight font-mono font-bold">
                {currentPrice}
              </span>
            </div>
            <div className="flex flex-col items-end text-right">
              <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">
                Time Remaining
              </span>
              <span className="font-label-bold text-label-bold text-on-surface flex items-center gap-1 font-mono">
                <span className="material-symbols-outlined text-[14px] text-secondary">timer</span>
                {timeLeft}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Button */}
      <div className="px-6 pb-6 pt-0">
        <button
          onClick={() => onEnterAuction(product)}
          className="w-full py-3 font-label-bold text-label-bold uppercase tracking-wider rounded border transition-all duration-300 bg-secondary/10 text-secondary border-secondary/40 hover:bg-secondary hover:text-on-secondary hover:border-transparent"
        >
          Enter Live Auction
        </button>
      </div>
    </article>
  );
}
