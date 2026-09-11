ALTER TABLE auctions ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_auctions_owner_id ON auctions(owner_id);
