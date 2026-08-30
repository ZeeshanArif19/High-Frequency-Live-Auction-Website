CREATE TABLE IF NOT EXISTS bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    user_id VARCHAR NOT NULL,
    bid_amount DECIMAL NOT NULL CHECK (bid_amount > 0),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
