/**
 * client/src/components/Products/ProductsPage.jsx
 *
 * Products listing page connected to the PostgreSQL database with real-time WebSocket updates.
 */

import React, { useState } from 'react';
import { ProductCard } from './ProductCard.jsx';
import { CategorySelect } from './CategorySelect.jsx';
import { useAuctionsList } from '../../hooks/useAuctionsList.js';
import { useAuth } from '../../context/AuthContext.jsx';

export function ProductsPage({ onNavigateHome, onAuctionSelect }) {
  const { auctions, loading, error } = useAuctionsList();
  const { user, isAuthenticated, openLogin, openRegister, openCreateAuction, openMyBids, logout } =
    useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [filterType, setFilterType] = useState('all'); // 'all', 'live', 'ending-soon'

  const filteredProducts = auctions.filter((product) => {
    const titleMatch = (product.item_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const descMatch = (product.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const idMatch = (product.id || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSearch = titleMatch || descMatch || idMatch;

    const matchesCategory =
      selectedCategory === 'All Categories' ||
      (product.category || '').toLowerCase() === selectedCategory.toLowerCase() ||
      (selectedCategory === 'Digital Assets' && product.category === 'Digital Asset');

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen flex flex-col w-full bg-surface text-on-surface">
      {/* Header Section */}
      <header className="fixed top-0 w-full z-40 bg-surface/90 backdrop-blur-xl shadow-[0_1px_12px_rgba(0,0,0,0.3)] border-b border-outline-variant/30">
        <div className="h-20 w-full px-8 md:px-16 flex items-center justify-between max-w-[1440px] mx-auto">
          {/* Logo */}
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <span className="font-headline-md text-headline-md tracking-tight uppercase text-on-surface">
              BidStream
            </span>
          </button>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={onNavigateHome}
              className="font-label-bold text-xs uppercase tracking-wider text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            >
              Home
            </button>
            <span className="transition-colors text-secondary font-bold text-sm">
              Live Lots
            </span>
            <button
              onClick={openCreateAuction}
              className="font-label-bold text-xs uppercase tracking-wider text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-secondary">add_circle</span>
              List Lot
            </button>
          </nav>

          {/* User Controls */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={openMyBids}
                  className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-bright text-xs font-mono text-on-surface border border-outline-variant/40 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm text-secondary">history</span>
                  <span>My Bids</span>
                </button>

                <div className="flex items-center gap-2 pl-2 border-l border-outline-variant/30">
                  <div className="w-8 h-8 rounded-full border border-secondary/50 bg-surface-container-high flex items-center justify-center font-mono text-xs text-secondary font-bold uppercase">
                    {user?.username?.slice(0, 2) || 'U'}
                  </div>
                  <span className="hidden lg:inline text-xs font-bold font-mono text-on-surface">
                    @{user?.username}
                  </span>
                </div>

                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={openLogin}
                  className="px-4 py-2 rounded-lg text-xs font-label-bold uppercase tracking-wider text-on-surface hover:text-secondary hover:bg-surface-container transition-colors cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={openRegister}
                  className="px-4 py-2 rounded-lg text-xs font-label-bold uppercase tracking-wider bg-secondary text-on-secondary hover:bg-secondary/90 transition-all font-bold cursor-pointer"
                >
                  Register
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full pt-20 flex-1">
        {/* Hero / Search Section */}
        <section className="w-full py-12 px-8 bg-surface-container relative overflow-hidden flex flex-col items-center text-center">
          {/* Abstract Background */}
          <div
            className="absolute inset-0 z-0 pointer-events-none opacity-20"
            style={{
              background: 'radial-gradient(circle at 50% -20%, var(--tw-colors-secondary) 0%, transparent 70%)',
            }}
          />

          <div className="relative z-10 max-w-4xl w-full flex flex-col items-center gap-6">
            <h1 className="font-display-lg text-display-lg text-on-surface uppercase tracking-tight">
              Live <span className="text-secondary">Markets</span>
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
              Real-time execution. Direct PostgreSQL database connectivity with sub-second WebSocket updates.
            </p>

            {/* Search & Filter Bar */}
            <div className="w-full max-w-3xl mt-4 bg-surface-container-high rounded-lg p-3 flex flex-col sm:flex-row items-center shadow-lg shadow-black/50 gap-4">
              <div className="flex items-center flex-1 w-full">
                <span className="material-symbols-outlined text-on-surface-variant ml-2 mr-2">
                  search
                </span>
                <input
                  className="flex-1 bg-transparent border-none text-on-surface font-body-md focus:outline-none placeholder:text-on-surface-variant/50"
                  placeholder="Search by item name, category, or ID..."
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="hidden sm:block h-8 w-[1px] bg-outline-variant" />
              <CategorySelect value={selectedCategory} onChange={setSelectedCategory} />
            </div>

            {/* Quick Filters */}
            <div className="flex gap-4 mt-2">
              <button
                onClick={() => {
                  setSelectedCategory('All Categories');
                  setSearchQuery('');
                }}
                className={`px-4 py-2 rounded-full font-label-sm text-label-sm flex items-center gap-2 transition-colors ${
                  selectedCategory === 'All Categories'
                    ? 'bg-secondary text-on-secondary'
                    : 'bg-surface-bright text-on-surface hover:bg-surface-variant'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                All Live Lots ({auctions.length})
              </button>
            </div>
          </div>
        </section>

        {/* Products Grid Section */}
        <section className="w-full py-12 px-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-end mb-8 border-b border-outline-variant pb-4">
            <h2 className="font-headline-md text-headline-md text-on-surface uppercase tracking-wide flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary">monitoring</span>
              Active Database Lots ({filteredProducts.length})
            </h2>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex justify-center items-center py-24">
              <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="p-6 bg-error/10 border border-error/30 rounded-lg text-center text-error">
              <p className="font-bold">Failed to connect to backend database</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && filteredProducts.length === 0 && (
            <div className="text-center py-20 bg-surface-container rounded-lg border border-outline-variant/30">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4">
                inventory_2
              </span>
              <p className="text-on-surface text-lg font-bold">No matching auction items found</p>
              <p className="text-on-surface-variant text-sm mt-1">
                Try adjusting your search criteria or filter categories.
              </p>
            </div>
          )}

          {/* Products Grid */}
          {!loading && filteredProducts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onEnterAuction={onAuctionSelect}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
