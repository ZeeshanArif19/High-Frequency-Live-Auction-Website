CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name VARCHAR NOT NULL,
    starting_price DECIMAL NOT NULL CHECK (starting_price > 0),
    current_max_bid DECIMAL NOT NULL,
    end_time TIMESTAMP NOT NULL
);
