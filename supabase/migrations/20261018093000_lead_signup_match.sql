-- Matching a lead to the account they became.
--
-- `leads.signed_up` has been a boolean somebody had to remember to tick since
-- the scoreboard shipped, so it has always been wrong and the conversion rate
-- per referrer has never meant anything. The address is in both tables; this
-- is the seam that lets a nightly job join them.
--
-- Plural and set-based so one call covers a whole batch. Execute is revoked
-- from everyone but the service role, like its two siblings: a bulk
-- email-to-account check in a signed-in user's hands tells them which of any
-- list of addresses has a BrandGauge account.
create or replace function auth_user_ids_for_emails(p_emails text[])
returns table (email text, user_id uuid)
language sql security definer stable
set search_path = public as $$
  select lower(u.email), u.id
  from auth.users u
  where lower(u.email) = any(
    select lower(e) from unnest(p_emails) as e
  );
$$;

revoke execute on function auth_user_ids_for_emails(text[]) from public;
revoke execute on function auth_user_ids_for_emails(text[]) from anon;
revoke execute on function auth_user_ids_for_emails(text[]) from authenticated;
grant  execute on function auth_user_ids_for_emails(text[]) to service_role;
