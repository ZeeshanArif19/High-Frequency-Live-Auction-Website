ALTER TABLE bids
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_bids_auction_winner_order
  ON bids(auction_id, bid_amount DESC, accepted_at ASC, id ASC);
