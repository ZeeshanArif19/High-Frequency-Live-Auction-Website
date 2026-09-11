/**
 * client/src/App.jsx
 *
 * Root component orchestrating LandingPage, ProductsPage, and live AuctionDetailPage,
 * wrapped with global AuthProvider and modals.
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { LandingPage } from './components/Landing/LandingPage.jsx';
import { ProductsPage } from './components/Products/ProductsPage.jsx';
import { AuctionDetailPage } from './components/Auction/AuctionDetailPage.jsx';
import { AuthModal } from './components/Auth/AuthModal.jsx';
import { CreateAuctionModal } from './components/Auction/CreateAuctionModal.jsx';
import { MyBidsModal } from './components/User/MyBidsModal.jsx';
import { fetchAuction } from './services/auctionService.js';

function AppContent() {
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedProduct, setSelectedProduct] = useState(null);

  const {
    authModalOpen,
    authModalMode,
    closeAuthModal,
    createAuctionOpen,
    closeCreateAuction,
    myBidsOpen,
    closeMyBids,
  } = useAuth();

  // Check initial URL params for auctionId
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auctionId = params.get('auctionId');
    if (auctionId) {
      fetchAuction(auctionId)
        .then((data) => {
          setSelectedProduct(data);
          setCurrentPage('auction');
        })
        .catch(() => {});
    }
  }, []);

  const handleSelectAuction = (product) => {
    setSelectedProduct(product);
    setCurrentPage('auction');
    const url = new URL(window.location);
    url.searchParams.set('auctionId', product.id);
    window.history.pushState({}, '', url);
  };

  const handleBackToProducts = () => {
    setSelectedProduct(null);
    setCurrentPage('products');
    const url = new URL(window.location);
    url.searchParams.delete('auctionId');
    window.history.pushState({}, '', url);
  };

  const handleNavigateHome = () => {
    setSelectedProduct(null);
    setCurrentPage('home');
    const url = new URL(window.location);
    url.searchParams.delete('auctionId');
    window.history.pushState({}, '', url);
  };

  return (
    <>
      {/* Dynamic Page Views */}
      {selectedProduct || currentPage === 'auction' ? (
        <AuctionDetailPage
          product={selectedProduct}
          onNavigateBack={handleBackToProducts}
          onAuctionSelect={handleSelectAuction}
        />
      ) : currentPage === 'products' ? (
        <ProductsPage
          onNavigateHome={handleNavigateHome}
          onAuctionSelect={handleSelectAuction}
        />
      ) : (
        <LandingPage
          onNavigateToProducts={() => setCurrentPage('products')}
          onAuctionSelect={handleSelectAuction}
        />
      )}

      {/* Global Modals */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={closeAuthModal}
      />

      <CreateAuctionModal
        isOpen={createAuctionOpen}
        onClose={closeCreateAuction}
        onAuctionCreated={(newAuction) => {
          handleSelectAuction(newAuction);
        }}
      />

      <MyBidsModal
        isOpen={myBidsOpen}
        onClose={closeMyBids}
        onSelectAuction={({ id }) => {
          fetchAuction(id)
            .then((data) => handleSelectAuction(data))
            .catch(() => {});
        }}
      />
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
