/**
 * client/src/components/Landing/Footer.jsx
 *
 * Footer component with branding and links.
 */

import React from 'react';

export function Footer() {
  const logoUrl =
    'https://lh3.googleusercontent.com/aida-public/AB6AXuD0eMdRYVC0X281HJEnaCJvv1skLQQBC5DaL1bQ8HIddaiQprIgJUX7grzD5-5lbZl_Z2DTxSWeAplP1ATTpT5kLKIzeZ_ZMPifgTN1iRzVXcYsQ9cVhnVENQR9NJQI2vYGRDDIZejtGbdsqNwfpoYj1xAlXjWjLhpzX3vx7gZpGATfInud6PbsErF_BZRIbNs_EKHk5fVLceYSzhsUz-yPS9SI-vPIq9baQLsTQ29ldFu3s0tMgmxbNw';

  return (
    <footer className="w-full bg-surface-container-lowest py-6 border-t border-outline-variant/30">
      <div className="max-w-[1440px] mx-auto px-32 flex flex-col md:flex-row justify-between items-center gap-12 text-on-surface-variant">
        {/* Logo and copyright */}
        <div className="flex items-center gap-2">
          <img alt="BidStream Logo" className="h-6 w-auto grayscale opacity-50" src={logoUrl} />
          <span className="font-label-bold text-label-bold tracking-widest text-xs">
            © 2024 BIDSTREAM GLOBAL
          </span>
        </div>

        {/* Links */}
        <div className="flex gap-8">
          <a
            className="text-label-sm font-label-sm hover:text-on-surface transition-colors uppercase tracking-wider"
            href="#"
          >
            Terms
          </a>
          <a
            className="text-label-sm font-label-sm hover:text-on-surface transition-colors uppercase tracking-wider"
            href="#"
          >
            Privacy
          </a>
          <a
            className="text-label-sm font-label-sm hover:text-on-surface transition-colors uppercase tracking-wider"
            href="#"
          >
            Security
          </a>
        </div>
      </div>
    </footer>
  );
}
