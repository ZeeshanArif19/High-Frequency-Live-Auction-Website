CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    provider_order_id VARCHAR(255) NOT NULL UNIQUE,
    provider_payment_id VARCHAR(255) UNIQUE,
    amount DECIMAL NOT NULL CHECK (amount > 0),
    status VARCHAR(32) NOT NULL DEFAULT 'PAYMENT_PENDING',
    failure_reason VARCHAR(255),
    webhook_event_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    CONSTRAINT payments_status_check CHECK (status IN ('PAYMENT_PENDING', 'PAID', 'PAYMENT_FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_payments_auction_id ON payments(auction_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_payment_per_auction
  ON payments(auction_id)
  WHERE status = 'PAYMENT_PENDING';