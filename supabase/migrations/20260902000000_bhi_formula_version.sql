-- Record which BHI formula produced each stored snapshot.
--
-- Until now the nightly job wrote a 3-component score (sentiment 40 / SOV 30 /
-- survey 30) while the Overview and Brand Equity pages computed a 7-component
-- score live, so the same brand had two different BHIs depending on the page.
-- The job now writes the 7-component score, which means existing rows and new
-- rows were produced by different formulas and are not comparable.
--
-- Version 1 = legacy 3-component. Version 2 = 7-component (src/lib/bhi-inputs.ts,
-- BHI_FORMULA_VERSION). Existing rows are backfilled to 1 rather than deleted,
-- so the history stays intact and any chart can label or exclude the older
-- segment instead of silently drawing two metrics as one line.

alter table brand_health_snapshots
  add column if not exists formula_version smallint not null default 2;

-- Everything written before this migration came from the legacy formula.
update brand_health_snapshots
   set formula_version = 1
 where created_at < now();

comment on column brand_health_snapshots.formula_version is
  '1 = legacy 3-component BHI (sentiment/SOV/survey). 2 = 7-component BHI. Scores across versions are not comparable.';

create index if not exists idx_bhi_brand_date_version
  on brand_health_snapshots(brand_id, formula_version, snapshot_date desc);

-- brand_health_snapshots already has RLS enabled with a workspace-scoped policy
-- (brand_health_snapshots_all, initial schema). Adding a column does not change
-- that, and no new policy is required.
