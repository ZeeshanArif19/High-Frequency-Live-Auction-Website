/**
 * client/src/components/Products/CategorySelect.jsx
 *
 * Custom category dropdown styled to match the landing page design.
 */

import React, { useState, useRef, useEffect } from 'react';

const CATEGORIES = ['All Categories', 'Horology', 'Automotive', 'Digital Assets'];

export function CategorySelect({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Close dropdown when clicking outside or scrolling
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper function to update position
  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  // Update position when opening and add scroll/resize listeners
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      // Update position on scroll and resize while open
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen]);

  const handleSelect = (category) => {
    onChange(category);
    setIsOpen(false);
  };

  return (
    <div className="relative w-48" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-transparent text-on-surface font-label-bold text-label-bold py-3 px-4 rounded-lg border border-outline-variant hover:border-secondary hover:bg-surface-container/30 transition-all group focus:outline-none"
      >
        <span className="flex items-center gap-2 truncate">
          <span className="material-symbols-outlined text-on-surface-variant group-hover:text-secondary transition-colors text-[20px]">
            category
          </span>
          <span className="truncate">{value}</span>
        </span>
        <span
          className={`material-symbols-outlined text-on-surface-variant group-hover:text-secondary transition-all ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="fixed bg-surface-container border border-outline-variant rounded-lg shadow-2xl overflow-hidden z-50 animate-[slideDown_0.2s_ease-out]"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: `${position.width}px`,
          }}
        >
          <div className="max-h-64 overflow-y-auto">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => handleSelect(category)}
                className={`w-full text-left px-4 py-3 font-body-md transition-all flex items-center gap-3 ${
                  value === category
                    ? 'bg-secondary/10 text-secondary border-l-2 border-secondary'
                    : 'text-on-surface hover:bg-surface-container-high hover:text-secondary'
                }`}
              >
                {value === category && (
                  <span className="material-symbols-outlined text-secondary text-[18px]">
                    check
                  </span>
                )}
                {value !== category && <span className="w-[24px]" />}
                <span>{category}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
