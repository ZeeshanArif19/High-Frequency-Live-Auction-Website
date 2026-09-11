/**
 * client/src/services/formatters.js
 *
 * Currency, date, and countdown formatting utilities.
 */

/**
 * Formats a number or numeric string to INR currency (₹).
 * @param {number|string} amount
 * @returns {string} e.g. "₹24,17,000"
 */
export function formatINR(amount) {
  const num = Number(amount);
  if (isNaN(num)) return '₹0';
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/**
 * Computes remaining time formatted as "HH:MM:SS" or "MM:SS" from end_time.
 * @param {string|Date} endTime
 * @returns {string}
 */
export function getTimeRemaining(endTime) {
  if (!endTime) return '00:00:00';
  const total = Date.parse(endTime) - Date.now();
  if (total <= 0) return '00:00:00';

  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)));

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Computes total remaining seconds.
 * @param {string|Date} endTime
 * @returns {number}
 */
export function getRemainingSeconds(endTime) {
  if (!endTime) return 0;
  const total = Date.parse(endTime) - Date.now();
  return Math.max(0, Math.floor(total / 1000));
}
