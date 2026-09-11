/**
 * client/src/services/auctionService.js
 *
 * Service for communicating with backend auction HTTP endpoints (AGENTS.md §7).
 * Injects JWT Bearer token on authenticated operations.
 */

import { getToken } from './authService.js';

const API_BASE_URL =
  typeof window !== 'undefined' && window.location.port === '5173'
    ? 'http://localhost:3000'
    : '';

/**
 * Helper to safely parse JSON or extract text on error responses.
 */
async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }
  const text = await response.text();
  return { error: text || `HTTP ${response.status}: ${response.statusText}` };
}

/**
 * Helper to get default headers with optional auth token.
 */
function getAuthHeaders(extraHeaders = {}) {
  const headers = {
    Accept: 'application/json',
    ...extraHeaders,
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetches all auctions from PostgreSQL.
 *
 * @returns {Promise<Array<Object>>} List of auction objects.
 */
export async function fetchAuctions() {
  const response = await fetch(`${API_BASE_URL}/auctions`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    const errorMsg = data.error || `Failed to fetch auctions (${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Fetches auction details by ID.
 *
 * @param {string} auctionId - UUID of the auction.
 * @returns {Promise<Object>} Auction object.
 */
export async function fetchAuction(auctionId) {
  const response = await fetch(`${API_BASE_URL}/auctions/${auctionId}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    const errorMsg = data.error || `Failed to fetch auction (${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Fetches bid history for an auction.
 *
 * @param {string} auctionId - UUID of the auction.
 * @returns {Promise<Array<Object>>} List of bid records.
 */
export async function fetchAuctionBids(auctionId) {
  const response = await fetch(`${API_BASE_URL}/auctions/${auctionId}/bids`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    const errorMsg = data.error || `Failed to fetch bids (${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Submits a new bid for the given auction.
 * Enforces JWT Authorization header.
 *
 * @param {string} auctionId - UUID of the auction.
 * @param {Object} payload - { bidAmount: number, userId?: string }
 * @returns {Promise<Object>} { accepted: boolean, message?: string, error?: string, status: number }
 */
export async function placeBid(auctionId, { bidAmount, userId }) {
  const response = await fetch(`${API_BASE_URL}/auctions/${auctionId}/bids`, {
    method: 'POST',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      bidAmount: Number(bidAmount),
      userId,
    }),
  });

  const data = await parseResponseBody(response);

  return {
    status: response.status,
    accepted: response.status === 202,
    message: data.message,
    error: data.error,
  };
}

/**
 * Creates a new auction lot. Requires authentication.
 *
 * @param {Object} auctionData - {
 *   title, description, startingPrice, minimumBidIncrement,
 *   startTime, endTime, category, imageUrl, lotNumber
 * }
 * @returns {Promise<Object>} Created auction.
 */
export async function createAuction(auctionData) {
  const response = await fetch(`${API_BASE_URL}/auctions`, {
    method: 'POST',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(auctionData),
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    const errorMsg =
      data.error ||
      data.details?.[0]?.message ||
      `Failed to create auction (${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Updates an auction lot. Only the owner may modify.
 *
 * @param {string} auctionId
 * @param {Object} updateData
 * @returns {Promise<Object>} Updated auction.
 */
export async function updateAuction(auctionId, updateData) {
  const response = await fetch(`${API_BASE_URL}/auctions/${auctionId}`, {
    method: 'PUT',
    headers: getAuthHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(updateData),
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    const errorMsg = data.error || `Failed to update auction (${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Deletes an auction lot. Only the owner may delete.
 *
 * @param {string} auctionId
 * @returns {Promise<Object>} Result message.
 */
export async function deleteAuction(auctionId) {
  const response = await fetch(`${API_BASE_URL}/auctions/${auctionId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    const errorMsg = data.error || `Failed to delete auction (${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export async function initiateAuctionPayment(auctionId) {
  const response = await fetch(`${API_BASE_URL}/auctions/${auctionId}/payment`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  const data = await parseResponseBody(response);
  if (!response.ok) {
    const error = new Error(data.error || `Failed to initiate payment (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

/**
 * Fetches the bidding history for the currently logged in user.
 *
 * @returns {Promise<Array<Object>>}
 */
export async function fetchMyBids() {
  const response = await fetch(`${API_BASE_URL}/auctions/user/my-bids`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    const errorMsg = data.error || `Failed to fetch personal bids (${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Fetches auctions created by the logged in user.
 * Returns bid_count per auction for lifecycle context.
 *
 * @returns {Promise<Array<Object>>}
 */
export async function fetchMyAuctions() {
  const response = await fetch(`${API_BASE_URL}/auctions/user/my-auctions`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data = await parseResponseBody(response);

  if (!response.ok) {
    const errorMsg = data.error || `Failed to fetch user auctions (${response.status})`;
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return Array.isArray(data) ? data : [];
}
