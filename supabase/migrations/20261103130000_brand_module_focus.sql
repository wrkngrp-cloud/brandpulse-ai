-- Choose-your-goal onboarding.
--
-- A new brand picks what it wants BrandGauge for, and the sidebar shows only
-- the modules for those goals. Everything else stays one switch away in
-- Settings > Modules. Hidden, never locked: a direct link still opens.
--
-- show_all_modules defaults to true so every existing brand keeps the full
-- sidebar it has today. Onboarding sets it to false for a new brand.
--
-- No new table, so no new policy: brands_all already scopes reads and writes
-- to workspace members.

alter table brands add column if not exists focus_goals text[] not null default '{}';
alter table brands add column if not exists show_all_modules boolean not null default true;
