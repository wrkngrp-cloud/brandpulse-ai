alter table events
  add column if not exists activation_type text check (activation_type in (
    'event',
    'sampling',
    'roadshow',
    'church_mosque',
    'school_contact',
    'estate_community',
    'market_activation',
    'branded_truck',
    'sports_sponsorship',
    'concert_festival'
  )),
  add column if not exists samples_distributed integer,
  add column if not exists collateral_distributed integer,
  add column if not exists target_community_size integer,
  add column if not exists spend_breakdown jsonb; -- { agency: number, materials: number, sampling: number, logistics: number }
