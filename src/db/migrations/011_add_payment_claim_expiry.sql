CREATE TABLE IF NOT EXISTS auction_payment_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    bid_id UUID NOT NULL REFERENCES bids(id) ON DELETE RESTRICT,
    status VARCHAR(32) NOT NULL DEFAULT 'PAYMENT_PENDING',
    payment_deadline TIMESTAMPTZ NOT NULL,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expired_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    CONSTRAINT auction_payment_claims_status_check
      CHECK (status IN ('PAYMENT_PENDING', 'EXPIRED', 'PAID')),
    CONSTRAINT auction_payment_claims_auction_bid_key UNIQUE (auction_id, bid_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_claims_auction_status
  ON auction_payment_claims(auction_id, status);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS claim_id UUID REFERENCES auction_payment_claims(id) ON DELETE RESTRICT;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE payments
  ADD CONSTRAINT payments_status_check
  CHECK (status IN ('PAYMENT_PENDING', 'PAID', 'PAYMENT_FAILED', 'PAYMENT_EXPIRED'));

ALTER TABLE auctions
  DROP CONSTRAINT IF EXISTS auctions_status_check;

ALTER TABLE auctions
  ADD CONSTRAINT auctions_status_check
  CHECK (status IN ('SCHEDULED', 'LIVE', 'ENDED', 'PAYMENT_PENDING', 'SETTLED', 'UNSOLD'));

INSERT INTO auction_payment_claims (auction_id, user_id, bid_id, status, payment_deadline, settled_at)
SELECT id, winner_user_id::uuid, winning_bid_id,
       CASE WHEN status = 'SETTLED' THEN 'PAID' ELSE 'PAYMENT_PENDING' END,
       payment_deadline,
       CASE WHEN status = 'SETTLED' THEN settled_at ELSE NULL END
FROM auctions
WHERE winner_user_id IS NOT NULL
  AND winning_bid_id IS NOT NULL
  AND payment_deadline IS NOT NULL
  AND status IN ('ENDED', 'PAYMENT_PENDING', 'SETTLED')
ON CONFLICT (auction_id, bid_id) DO NOTHING;

UPDATE payments p
SET claim_id = c.id
FROM auction_payment_claims c
WHERE p.claim_id IS NULL
  AND p.auction_id = c.auction_id
  AND p.user_id = c.user_id;

UPDATE auction_payment_claims c
SET status = 'PAID', settled_at = COALESCE(c.settled_at, p.paid_at)
FROM payments p
WHERE p.claim_id = c.id AND p.status = 'PAID';
