/**
 * client/src/components/Landing/AuctionGrid.jsx
 *
 * Grid section displaying active auctions from the database.
 */

import React from 'react';
import { AuctionCardLanding } from './AuctionCardLanding.jsx';

export function AuctionGrid({ auctions = [], loading = false, onNavigateToProducts, onSelectAuction }) {
  return (
    <section className="px-8 md:px-32 py-24 max-w-[1440px] mx-auto w-full">
      {/* Header */}
      <div className="flex justify-between items-end mb-12">
        <div>
          <h2 className="font-headline-md text-3xl md:text-[36px] font-bold text-on-surface uppercase tracking-tight">
            Active Markets
          </h2>
          <p className="font-body-md text-on-surface-variant mt-2 text-base md:text-lg">
            High-liquidity assets currently in live bidding session.
          </p>
        </div>
        <button
          onClick={onNavigateToProducts}
          className="hidden md:flex items-center gap-2 text-label-bold font-label-bold text-on-surface hover:text-secondary transition-colors uppercase tracking-wide"
        >
          VIEW ALL ({auctions.length}){' '}
          <span
            className="material-symbols-outlined text-base"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            arrow_forward
          </span>
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && auctions.length === 0 && (
        <div className="text-center py-16 bg-surface-container rounded-lg border border-outline-variant/30">
          <p className="text-on-surface-variant font-body-md">No active auctions found in database.</p>
        </div>
      )}

      {/* Auctions grid */}
      {!loading && auctions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {auctions.slice(0, 6).map((auction) => (
            <AuctionCardLanding
              key={auction.id}
              auction={auction}
              onSelectAuction={onSelectAuction}
            />
          ))}
        </div>
      )}
    </section>
  );
}
