-- influencer_posts.metric_sources
--
-- Records where each engagement number came from, so the UI can never imply a
-- pulled figure when the number was typed in or estimated. Shape:
--   { "likes": "pulled", "comments": "pulled", "reach": "entered" }
-- Allowed values: pulled (read from the platform API), entered (typed by the
-- brand), estimated (derived by us from another figure). A metric with no value
-- is absent rather than recorded, so an omitted key is not a zero.
--
-- RLS is already enabled on influencer_posts with a workspace-scoped policy
-- (20260626000002_influencer_posts.sql); adding a column inherits it.

alter table influencer_posts
  add column if not exists metric_sources jsonb not null default '{}'::jsonb;

comment on column influencer_posts.metric_sources is
  'Per-metric provenance: pulled | entered | estimated. Keys match the metric columns.';

-- The API route whitelists both keys and values, but this column is the record
-- of how a number was obtained, so the shape is enforced here too rather than
-- resting on one caller staying correct. Guarded so the migration stays safe to
-- re-run.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'influencer_posts'::regclass
      and conname  = 'influencer_posts_metric_sources_is_object'
  ) then
    alter table influencer_posts
      add constraint influencer_posts_metric_sources_is_object
      check (jsonb_typeof(metric_sources) = 'object');
  end if;
end $$;
