-- Rebrand stored data: BrandPulse -> BrandGauge (2026-07-12).
-- Rewrites brand strings in every public text/varchar/jsonb column, plus the demo
-- auth accounts. Stored links to brandpulse-ai-tau.vercel.app are protected: that is
-- the live deployment URL behind printed QR codes and installed pixels and must keep
-- working verbatim.

do $$
declare
  r record;
begin
  for r in
    select c.table_name, c.column_name, c.data_type
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and c.is_updatable = 'YES'
      and c.data_type in ('text', 'character varying', 'jsonb')
  loop
    begin
      if r.data_type = 'jsonb' then
        execute format($f$
          update public.%1$I set %2$I =
            replace(
              replace(replace(replace(replace(replace(replace(
                replace(%2$I::text, 'brandpulse-ai-tau.vercel.app', '__KEEP_VERCEL__'),
              'BrandPulse AI', 'BrandGauge'),
              'BrandPulse', 'BrandGauge'),
              'BRANDPULSE', 'BRANDGAUGE'),
              'Brandpulse', 'Brandgauge'),
              'brandpulse.ai', 'brandgauge.app'),
              'brandpulse', 'brandgauge'),
            '__KEEP_VERCEL__', 'brandpulse-ai-tau.vercel.app')::jsonb
          where %2$I::text ilike '%%brandpulse%%'
        $f$, r.table_name, r.column_name);
      else
        execute format($f$
          update public.%1$I set %2$I =
            replace(
              replace(replace(replace(replace(replace(replace(
                replace(%2$I, 'brandpulse-ai-tau.vercel.app', '__KEEP_VERCEL__'),
              'BrandPulse AI', 'BrandGauge'),
              'BrandPulse', 'BrandGauge'),
              'BRANDPULSE', 'BRANDGAUGE'),
              'Brandpulse', 'Brandgauge'),
              'brandpulse.ai', 'brandgauge.app'),
              'brandpulse', 'brandgauge'),
            '__KEEP_VERCEL__', 'brandpulse-ai-tau.vercel.app')
          where %2$I ilike '%%brandpulse%%'
        $f$, r.table_name, r.column_name);
      end if;
    exception when others then
      -- generated/constrained columns are skipped rather than failing the migration
      raise notice 'rebrand sweep skipped %.%: %', r.table_name, r.column_name, sqlerrm;
    end;
  end loop;
end $$;

-- Demo login accounts: the app matches demo mode on emails ending .brandgauge.app.
update auth.users
set email = replace(email, '.brandpulse.ai', '.brandgauge.app'),
    raw_user_meta_data = replace(raw_user_meta_data::text, '.brandpulse.ai', '.brandgauge.app')::jsonb
where email like 'demo@%.brandpulse.ai';

update auth.identities
set identity_data = replace(identity_data::text, '.brandpulse.ai', '.brandgauge.app')::jsonb
where identity_data::text like '%.brandpulse.ai%';
