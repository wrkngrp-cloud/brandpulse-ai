-- Add event-level creative reference so the visual scanner can look for it in event photos

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS creative_url TEXT;
