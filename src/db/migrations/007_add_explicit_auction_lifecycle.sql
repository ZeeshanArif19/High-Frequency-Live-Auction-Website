ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
  ADD COLUMN IF NOT EXISTS winner_user_id VARCHAR,
  ADD COLUMN IF NOT EXISTS winning_bid_id UUID,
  ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMP,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP;

UPDATE auctions
SET status = CASE
  WHEN CURRENT_TIMESTAMP < start_time THEN 'SCHEDULED'
  WHEN CURRENT_TIMESTAMP < end_time THEN 'LIVE'
  ELSE 'ENDED'
END
WHERE status = 'SCHEDULED';

ALTER TABLE auctions
  DROP CONSTRAINT IF EXISTS auctions_status_check;

ALTER TABLE auctions
  ADD CONSTRAINT auctions_status_check
  CHECK (status IN ('SCHEDULED', 'LIVE', 'ENDED', 'PAYMENT_PENDING', 'SETTLED'));

CREATE INDEX IF NOT EXISTS idx_auctions_status_start_time
  ON auctions(status, start_time);

CREATE INDEX IF NOT EXISTS idx_auctions_status_end_time
  ON auctions(status, end_time);

CREATE INDEX IF NOT EXISTS idx_auctions_payment_deadline
  ON auctions(status, payment_deadline);
