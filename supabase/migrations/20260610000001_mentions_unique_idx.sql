-- Enforce one row per external tweet/mention per brand+platform.
-- Partial: allows external_id to remain null for manually entered mentions.
create unique index mentions_brand_platform_external_key
  on mentions(brand_id, platform, external_id)
  where external_id is not null;
