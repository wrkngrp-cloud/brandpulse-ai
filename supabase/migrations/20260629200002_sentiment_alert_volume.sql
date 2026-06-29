-- Track what triggered a sentiment notification so the bell can distinguish a
-- score move from a complaint-volume surge.
-- notifications schema (initial): id, brand_id, user_id, type, title, body, href,
-- read_at, created_at. We add alert metadata columns below.
alter table notifications add column if not exists alert_subtype text
  check (alert_subtype in ('score_drop','score_spike','volume_surge','volume_crash','sustained_negative'));
alter table notifications add column if not exists baseline_value numeric;
alter table notifications add column if not exists current_value numeric;
alter table notifications add column if not exists z_score numeric;
