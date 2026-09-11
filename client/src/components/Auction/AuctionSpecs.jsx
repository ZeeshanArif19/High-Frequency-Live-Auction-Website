/**
 * client/src/components/Auction/AuctionSpecs.jsx
 *
 * Technical specifications and provenance card.
 */

import React from 'react';

export function AuctionSpecs() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Specifications */}
      <div className="bg-surface-container rounded-lg p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-secondary">analytics</span>
          <h2 className="font-headline-sm text-headline-sm text-on-surface">Specifications</h2>
        </div>
        <dl className="space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-outline-variant/30">
            <dt className="text-label-sm font-label-bold text-on-surface-variant uppercase tracking-wider">
              Reference
            </dt>
            <dd className="text-body-md font-body-md text-on-surface">403.035</dd>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-outline-variant/30">
            <dt className="text-label-sm font-label-bold text-on-surface-variant uppercase tracking-wider">
              Movement
            </dt>
            <dd className="text-body-md font-body-md text-on-surface">Caliber L951.1 (Manual)</dd>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-outline-variant/30">
            <dt className="text-label-sm font-label-bold text-on-surface-variant uppercase tracking-wider">
              Case Material
            </dt>
            <dd className="text-body-md font-body-md text-on-surface">950 Platinum</dd>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-outline-variant/30">
            <dt className="text-label-sm font-label-bold text-on-surface-variant uppercase tracking-wider">
              Dimensions
            </dt>
            <dd className="text-body-md font-body-md text-on-surface">39.0mm x 12.8mm</dd>
          </div>
          <div className="flex justify-between items-center pb-2">
            <dt className="text-label-sm font-label-bold text-on-surface-variant uppercase tracking-wider">
              Complications
            </dt>
            <dd className="text-body-md font-body-md text-on-surface">Flyback Chronograph, Date</dd>
          </div>
        </dl>
      </div>

      {/* Provenance & Authentication */}
      <div className="bg-surface-container rounded-lg p-6 shadow-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-secondary">verified</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Provenance & Authentication</h2>
          </div>
          <p className="text-body-md text-on-surface-variant mb-4 leading-relaxed">
            This specific timepiece remains in exceptional, unpolished condition. Consigned directly by the
            original owner with complete documentation.
          </p>
        </div>
        <div className="bg-surface-container-high rounded-lg p-4 flex items-center justify-between shadow-inner border border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary">gpp_good</span>
            </div>
            <div>
              <p className="text-label-bold font-label-bold text-on-surface">Certified Authentic</p>
              <p className="text-label-sm text-on-surface-variant">BidStream Verification</p>
            </div>
          </div>
          <button className="text-label-bold font-label-bold text-secondary hover:text-secondary/80 transition-colors underline decoration-secondary/50 underline-offset-4">
            View Report
          </button>
        </div>
      </div>
    </div>
  );
}
