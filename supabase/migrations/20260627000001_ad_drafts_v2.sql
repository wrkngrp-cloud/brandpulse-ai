-- Extend ad_drafts with campaign-level, ad-set-level, and richer creative fields
-- Adds: campaign hierarchy names, objective, ad format, creative_config (carousel/RSA/display)
-- and ad-set targeting extras: device_targeting, optimization_goal, bid_strategy, bid_amount

alter table ad_drafts
  add column if not exists campaign_name        text,
  add column if not exists ad_set_name          text,
  add column if not exists ad_name              text,
  add column if not exists objective            text check (objective in (
    'awareness','traffic','engagement','leads','app','sales'
  )),
  add column if not exists special_ad_category  text check (special_ad_category in (
    'none','housing','employment','credit','social_issues'
  )) default 'none',
  add column if not exists ad_format            text check (ad_format in (
    'single_image','video','carousel',
    'responsive_search','responsive_display',
    'tiktok_video','linkedin_image','linkedin_video','linkedin_carousel','text_ad'
  )),
  add column if not exists creative_config      jsonb default '{}',
  add column if not exists placements_auto      boolean default true,
  add column if not exists device_targeting     text default 'all'
                                                 check (device_targeting in ('all','mobile','desktop')),
  add column if not exists optimization_goal    text,
  add column if not exists bid_strategy         text default 'lowest_cost'
                                                 check (bid_strategy in ('lowest_cost','bid_cap','target_cost','target_roas')),
  add column if not exists bid_amount           numeric(12,2);
