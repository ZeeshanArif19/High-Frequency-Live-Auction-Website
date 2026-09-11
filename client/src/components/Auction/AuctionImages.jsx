/**
 * client/src/components/Auction/AuctionImages.jsx
 *
 * Image gallery displaying the live auction asset.
 */

import React from 'react';

export function AuctionImages({ product }) {
  const imageUrl = product.image_url || product.imageUrl;
  const title = product.item_name || product.title;
  const description = product.description;

  return (
    <div className="bg-surface-container rounded-lg shadow-2xl overflow-hidden relative border border-outline-variant/30">
      {/* Status Badge */}
      <div className="absolute top-6 left-6 z-10 flex items-center gap-2 bg-surface/80 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-outline-variant/50">
        <div className="w-3 h-3 rounded-full bg-secondary animate-pulse shadow-[0_0_12px_rgba(217,119,6,0.8)]" />
        <span className="font-label-bold text-label-bold tracking-widest text-on-surface uppercase text-xs">
          Live Auction Session
        </span>
      </div>

      {product.lot_number && (
        <div className="absolute top-6 right-6 z-10 bg-surface/80 backdrop-blur-md px-3 py-1.5 rounded font-mono text-xs text-on-surface-variant border border-outline-variant">
          LOT #{product.lot_number}
        </div>
      )}

      {/* Main Image */}
      <div
        className="aspect-video w-full bg-cover bg-center relative min-h-[420px]"
        style={{
          backgroundImage: `url('${imageUrl}')`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6">
          <span className="text-secondary font-label-bold text-label-sm uppercase tracking-wider block mb-1">
            {product.category || 'Exchange Lot'}
          </span>
          <h1 className="font-display-lg text-3xl md:text-5xl text-on-surface mb-2 font-bold">
            {title}
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-3xl leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
