-- metric_manual is written everywhere with
--   upsert(..., { onConflict: 'brand_id,metric_key,period_start' })
-- but no unique index on those columns was ever created, so Postgres rejects
-- the ON CONFLICT clause and every one of those writes fails. Deduplicate any
-- rows that slipped in via plain inserts, then add the index the upserts need.

delete from metric_manual a
using metric_manual b
where a.brand_id     = b.brand_id
  and a.metric_key   = b.metric_key
  and a.period_start = b.period_start
  and a.ctid > b.ctid;

create unique index if not exists uq_metric_manual_brand_key_period
  on metric_manual (brand_id, metric_key, period_start);
