-- Links emmanuel@brandgauge.app to the account signed in as
-- adebusuyiadejobi@gmail.com. Same fail-loud shape as the Grillo migration:
-- if that account does not exist, something is wrong with the assumption,
-- not with timing, since this account has been live the whole session.

do $$
declare
  emmanuel_id uuid;
begin
  select id into emmanuel_id from auth.users where lower(email) = 'adebusuyiadejobi@gmail.com';

  if emmanuel_id is null then
    raise exception 'No auth.users row for adebusuyiadejobi@gmail.com.';
  end if;

  insert into staff_mailboxes (user_id, address) values (emmanuel_id, 'emmanuel@brandgauge.app')
  on conflict (address) do nothing;
end $$;
