-- Initialize the hot state for an auction without overwriting a newer bid.
-- KEYS[1]: auction:{id}:max_bid
-- ARGV[1]: authoritative current_max_bid from PostgreSQL

if redis.call('EXISTS', KEYS[1]) == 0 then
  redis.call('SET', KEYS[1], ARGV[1])
end

return 1
