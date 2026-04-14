-- One-time cleanup: delete training sessions that lasted under 30 seconds.
-- These are accidental taps, failed connections, or test runs.
--
-- The app now enforces this at save time, so only historical data needs cleanup.
--
-- NOTE: sessions_used counters on the users table are NOT decremented here.
-- Those counts are small and decrementing them retroactively would be complex.
-- If needed, you can reset a user's counter manually:
--   UPDATE users SET sessions_used = 0 WHERE id = '<user_id>';

DELETE FROM training_sessions
WHERE EXTRACT(EPOCH FROM (ended_at - started_at)) < 30;
