-- 006_add_auction_lifecycle_and_increments.sql
--
-- Adds title, start_time, and minimum_bid_increment columns to auctions table,
-- and creates indexes on lifecycle timestamps for high-frequency queries.

ALTER TABLE auctions ADD COLUMN IF NOT EXISTS title VARCHAR;
UPDATE auctions SET title = item_name WHERE title IS NULL;

ALTER TABLE auctions ADD COLUMN IF NOT EXISTS start_time TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE auctions ADD COLUMN IF NOT EXISTS minimum_bid_increment DECIMAL NOT NULL DEFAULT 1.0 CHECK (minimum_bid_increment > 0);

CREATE INDEX IF NOT EXISTS idx_auctions_start_time ON auctions(start_time);
CREATE INDEX IF NOT EXISTS idx_auctions_end_time ON auctions(end_time);
