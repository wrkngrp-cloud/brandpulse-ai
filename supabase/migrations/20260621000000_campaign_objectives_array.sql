-- Replace single objective with objectives array on campaigns
-- Add objectives array to campaign_channels for channel-level attribution

alter table campaigns
  add column if not exists objectives text[] not null default '{}';

-- Migrate existing single objective value into the array
update campaigns
  set objectives = array[objective]
  where objective is not null and array_length(objectives, 1) is null;

-- Keep objective column for now (backward compat), but objectives[] is authoritative
-- campaign_channels: link each channel to the objectives it serves
alter table campaign_channels
  add column if not exists objectives text[] not null default '{}';
