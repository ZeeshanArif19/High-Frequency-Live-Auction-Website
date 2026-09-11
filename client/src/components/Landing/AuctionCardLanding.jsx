/**
 * client/src/components/Landing/AuctionCardLanding.jsx
 *
 * Individual auction card component for landing page grid using live database auction data.
 */

import React, { useState, useEffect } from 'react';
import { formatINR, getTimeRemaining } from '../../services/formatters.js';

export function AuctionCardLanding({ auction, onSelectAuction }) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeRemaining(auction.end_time));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeRemaining(auction.end_time));
    }, 1000);
    return () => clearInterval(timer);
  }, [auction.end_time]);

  const currentPrice = formatINR(auction.current_max_bid || auction.starting_price);
  const isEnded = timeLeft === '00:00:00';

  return (
    <article
      onClick={() => onSelectAuction && onSelectAuction(auction)}
      className="bg-surface-container flex flex-col rounded-sm overflow-hidden border border-outline-variant hover:border-secondary/70 transition-all duration-300 group relative shadow-2xl cursor-pointer"
    >
      {/* Live badge */}
      <div className="absolute top-5 left-5 z-20 flex items-center gap-2 bg-surface/95 backdrop-blur px-3 py-1.5 rounded-sm border border-secondary/50 shadow-[0_0_15px_rgba(217,119,6,0.3)]">
        <span className={`w-2 h-2 rounded-full ${isEnded ? 'bg-outline' : 'bg-secondary animate-pulse'}`} />
        <span className="font-label-bold text-[11px] text-on-surface uppercase tracking-widest font-bold">
          {isEnded ? 'Ended' : (auction.category || 'Live Auction')}
        </span>
      </div>

      {/* Lot Number */}
      {auction.lot_number && (
        <div className="absolute top-5 right-5 z-20 bg-surface/90 backdrop-blur-sm px-2.5 py-1 rounded-sm font-mono text-[11px] text-on-surface-variant border border-outline-variant/60">
          LOT #{auction.lot_number}
        </div>
      )}

      {/* Image container with gradient overlay */}
      <div className="relative h-72 w-full bg-surface-container-high overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-700 ease-out"
          style={{
            backgroundImage: `url('${auction.image_url}')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-container via-surface-container/20 to-transparent opacity-90" />

        {/* Price and countdown overlay */}
        <div className="absolute bottom-0 w-full p-6 flex justify-between items-end">
          <div className="flex flex-col">
            <span className="font-label-sm text-[11px] text-on-surface-variant uppercase tracking-widest mb-1.5 font-semibold">
              Current Highest Bid
            </span>
            <span className="font-price-display text-[28px] text-on-surface tabular-nums leading-none font-bold text-secondary">
              {currentPrice}
            </span>
          </div>
          <div className="text-right">
            <span className="font-label-sm text-[11px] text-on-surface-variant uppercase tracking-widest block mb-1.5 font-semibold">
              Closing In
            </span>
            <span className="font-headline-sm text-on-surface tabular-nums font-mono text-sm">{timeLeft}</span>
          </div>
        </div>
      </div>

      {/* Content section */}
      <div className="p-6 flex flex-col gap-5 flex-grow justify-between">
        <div>
          <h3 className="font-headline-sm text-on-surface truncate text-lg font-bold group-hover:text-secondary transition-colors">
            {auction.item_name}
          </h3>
          <p className="font-body-md text-sm text-on-surface-variant mt-2 line-clamp-2 leading-relaxed">
            {auction.description || 'Rare collectible authenticated and certified for exchange.'}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
          <div
            className="h-full bg-secondary rounded-full origin-left transition-all duration-1000 shadow-[0_0_10px_rgba(217,119,6,0.5)]"
            style={{ width: isEnded ? '100%' : '75%' }}
          />
        </div>

        {/* Execute bid button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectAuction && onSelectAuction(auction);
          }}
          className="w-full bg-surface-bright hover:bg-secondary hover:text-on-secondary text-on-surface border border-outline-variant/50 font-label-bold text-label-bold py-3.5 rounded-sm transition-all uppercase tracking-widest mt-1 shadow-md group-hover:border-secondary"
        >
          Enter Auction Room
        </button>
      </div>
    </article>
  );
}
