-- influencer_posts.metric_sources
--
-- Records where each engagement number came from, so the UI can never imply a
-- pulled figure when the number was typed in or estimated. Shape:
--   { "likes": "pulled", "comments": "pulled", "reach": "entered" }
-- Allowed values: pulled (read from the platform API), entered (typed by the
-- brand), estimated (derived by us from another figure).
--
-- RLS is already enabled on influencer_posts with a workspace-scoped policy
-- (20260626000002_influencer_posts.sql); adding a column inherits it.

alter table influencer_posts
  add column if not exists metric_sources jsonb not null default '{}'::jsonb;

comment on column influencer_posts.metric_sources is
  'Per-metric provenance: pulled | entered | estimated. Keys match the metric columns.';
