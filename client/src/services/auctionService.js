/**
 * client/src/services/auctionService.js
 *
 * Service for communicating with the backend auction HTTP endpoints (AGENTS.md §7, TASK.md §STEP-11).
 */

const API_BASE_URL = '';

/**
 * Fetches auction details by ID.
 *
 * @param {string} auctionId - UUID of the auction.
 * @returns {Promise<Object>} Auction object { id, item_name, starting_price, current_max_bid, end_time }.
 */
export async function fetchAuction(auctionId) {
  const response = await fetch(`${API_BASE_URL}/auctions/${auctionId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || `Failed to fetch auction (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Submits a new bid for the given auction.
 *
 * @param {string} auctionId - UUID of the auction.
 * @param {Object} payload - { userId: string, bidAmount: number }
 * @returns {Promise<Object>} { accepted: boolean, message?: string, error?: string, status: number }
 */
export async function placeBid(auctionId, { userId, bidAmount }) {
  const response = await fetch(`${API_BASE_URL}/auctions/${auctionId}/bids`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      userId,
      bidAmount: Number(bidAmount),
    }),
  });

  const data = await response.json();

  return {
    status: response.status,
    accepted: response.status === 202,
    message: data.message,
    error: data.error,
  };
}
