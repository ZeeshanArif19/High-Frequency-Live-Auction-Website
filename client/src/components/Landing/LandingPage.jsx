/**
 * client/src/components/Landing/LandingPage.jsx
 *
 * Main landing page component connected to the database with real-time WebSocket updates.
 */

import React from 'react';
import { Header } from './Header.jsx';
import { Hero } from './Hero.jsx';
import { StatsBar } from './StatsBar.jsx';
import { AuctionGrid } from './AuctionGrid.jsx';
import { Footer } from './Footer.jsx';
import { useAuctionsList } from '../../hooks/useAuctionsList.js';

export function LandingPage({ onNavigateToProducts, onAuctionSelect }) {
  const { auctions, loading } = useAuctionsList();

  return (
    <div className="flex flex-col w-full relative overflow-x-hidden">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-surface">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-surface-bright/20 via-surface to-surface" />
      </div>

      {/* Header */}
      <Header
        onNavigateToProducts={onNavigateToProducts}
        onNavigateHome={() => {}}
      />

      {/* Main content (offset for fixed header) */}
      <main className="w-full pt-20 bg-surface">
        {/* Hero Section */}
        <Hero onNavigateToProducts={onNavigateToProducts} />

        {/* Stats Bar */}
        <StatsBar auctions={auctions} />

        {/* Auction Grid */}
        <AuctionGrid
          auctions={auctions}
          loading={loading}
          onNavigateToProducts={onNavigateToProducts}
          onSelectAuction={onAuctionSelect}
        />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
