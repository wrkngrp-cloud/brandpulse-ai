-- Add per-platform sentiment breakdown to sentiment_daily.
-- Stored as JSONB so future platforms (TikTok, LinkedIn) slot in without schema changes.
-- Shape: { "twitter": { volume, score, positive_pct, neutral_pct, negative_pct }, "instagram": {...} }
-- The top-level social_score column becomes the volume-weighted blend of all platform scores.
alter table sentiment_daily
  add column if not exists platform_breakdown jsonb not null default '{}';
