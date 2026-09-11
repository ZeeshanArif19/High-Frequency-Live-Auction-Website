/**
 * client/src/components/Landing/StatsBar.jsx
 *
 * Real-time stats bar showing active markets and live database volume.
 */

import React from 'react';
import { formatINR } from '../../services/formatters.js';

export function StatsBar({ auctions = [] }) {
  const totalVolume = auctions.reduce(
    (acc, cur) => acc + Number(cur.current_max_bid || cur.starting_price || 0),
    0
  );

  const activeMarketsCount = auctions.length;

  return (
    <section className="w-full bg-surface-container py-4 border-y border-outline-variant/40 overflow-hidden shadow-inner">
      <div className="max-w-[1440px] mx-auto px-8 md:px-32 flex flex-col md:flex-row justify-between items-center gap-6">
        {/* Active Markets */}
        <div className="flex items-center gap-5 w-full md:w-auto">
          <span
            className="material-symbols-outlined text-secondary text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            gavel
          </span>
          <div>
            <div className="font-label-sm text-[11px] text-on-surface-variant uppercase tracking-widest font-semibold mb-1">
              Active Lots
            </div>
            <div className="font-headline-md text-headline-md text-on-surface tabular-nums font-bold">
              {activeMarketsCount} Live
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-16 bg-outline-variant/50" />

        {/* Total Market Value */}
        <div className="flex items-center gap-5 w-full md:w-auto">
          <span
            className="material-symbols-outlined text-secondary text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            currency_exchange
          </span>
          <div>
            <div className="font-label-sm text-[11px] text-on-surface-variant uppercase tracking-widest font-semibold mb-1">
              Total Market Value
            </div>
            <div className="font-headline-md text-headline-md text-on-surface tabular-nums font-bold">
              {formatINR(totalVolume)}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-16 bg-outline-variant/50" />

        {/* Real-Time Processing */}
        <div className="flex items-center gap-5 w-full md:w-auto">
          <span
            className="material-symbols-outlined text-secondary text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            bolt
          </span>
          <div>
            <div className="font-label-sm text-[11px] text-on-surface-variant uppercase tracking-widest font-semibold mb-1">
              Processing Mode
            </div>
            <div className="font-headline-md text-headline-md text-secondary tabular-nums font-bold">
              Sub-ms Atomic
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
