-- try_place_bid.lua
--
-- Atomically checks if an incoming bid is strictly greater than the current
-- maximum bid stored at the given key, and updates it if so.
--
-- KEYS[1]  : auction:{id}:max_bid  — the Redis key holding the current max bid
-- ARGV[1]  : incoming bid amount   — the new bid to compare against
--
-- Returns:
--   1  → bid accepted  (incoming > current, key was updated)
--   0  → bid rejected  (incoming ≤ current, key unchanged)

local current = redis.call('GET', KEYS[1])

-- If no bid exists yet, treat as -infinity so any valid bid is accepted
if current == false then
    redis.call('SET', KEYS[1], ARGV[1])
    return 1
end

if tonumber(ARGV[1]) > tonumber(current) then
    redis.call('SET', KEYS[1], ARGV[1])
    return 1
end

return 0
