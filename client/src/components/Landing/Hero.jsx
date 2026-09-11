/**
 * client/src/components/Landing/Hero.jsx
 *
 * Hero section with headline and CTA buttons.
 */

import React, { useState, useEffect } from 'react';
import { heroBackgroundImage } from '../../data/placeholderData.js';

export function Hero({ onNavigateToProducts }) {
  const [tradesPerSecond, setTradesPerSecond] = useState(84.9);

  // Animate the trades per second ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setTradesPerSecond((current) => {
        const variation = (Math.random() - 0.5) * 2; // Random between -1 and 1
        let next = current + variation;

        // Keep bounds
        if (next < 70) next = 70;
        if (next > 99) next = 99;

        return parseFloat(next.toFixed(1));
      });
    }, 800);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-[600px] flex flex-col justify-center px-32 py-32">
      {/* Background image with overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay"
        style={{
          backgroundImage: `url('${heroBackgroundImage}')`,
        }}
      />

      {/* Content grid */}
      <div className="relative z-10 max-w-[1440px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-24 items-center">
        {/* Left column: Headlines and CTA */}
        <div className="lg:col-span-7 flex flex-col gap-8">
          {/* Main headline */}
          <h1 className="font-display-lg text-display-lg md:text-[80px] md:leading-[1.05] text-on-surface uppercase tracking-tighter">
            The Velocity <br />
            of <span className="text-secondary">Value.</span>
          </h1>

          {/* Subheadline */}
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl leading-relaxed">
            Real-time, high-stakes auctions. Execute bids with sub-second latency in a
            zero-sum market. The definitive platform for acquiring rare assets.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center gap-4 mt-6">
            <button
              onClick={onNavigateToProducts}
              className="bg-secondary hover:bg-secondary/90 text-on-secondary font-label-bold text-label-bold px-10 py-4 rounded-sm transition-all duration-200 transform hover:-translate-y-0.5 shadow-[0_4px_14px_rgba(217,119,6,0.3)] tracking-wide uppercase"
            >
              Enter Live Market
            </button>
            <button
              onClick={onNavigateToProducts}
              className="bg-transparent border border-outline-variant hover:border-outline hover:bg-surface-container text-on-surface font-label-bold text-label-bold px-10 py-4 rounded-sm transition-all duration-200 tracking-wide uppercase"
            >
              View Upcoming
            </button>
          </div>
        </div>

        {/* Right column: Data visualization / Trades ticker */}
        <div className="lg:col-span-5 hidden lg:block relative h-[500px]">
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Animated circles */}
            <svg
              className="w-full h-full opacity-40 text-secondary animate-[spin_120s_linear_infinite]"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              viewBox="0 0 100 100"
            >
              <circle cx="50" cy="50" r="40" strokeDasharray="2 4" />
              <circle className="text-on-surface-variant" cx="50" cy="50" r="32" strokeDasharray="1 8" />
              <circle cx="50" cy="50" r="24" strokeDasharray="4 2" />
            </svg>

            {/* Central stats card */}
            <div className="absolute flex flex-col items-center justify-center text-center bg-surface/50 w-48 h-48 rounded-full backdrop-blur-sm border border-outline-variant/30">
              <span className="font-display-lg text-[64px] text-on-surface leading-none tracking-tighter tabular-nums">
                {tradesPerSecond}
              </span>
              <span className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-widest mt-3">
                Trades / Sec
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
