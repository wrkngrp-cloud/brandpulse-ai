-- Links grillo@brandgauge.app to Grillo Adebiyi's Desk account, once it
-- exists. Fails loudly rather than silently inserting nothing if his invite
-- (grilloadebiyi@gmail.com) has not been accepted yet — push this again once
-- it has, rather than guessing at timing.

do $$
declare
  grillo_id uuid;
begin
  select id into grillo_id from auth.users where lower(email) = 'grilloadebiyi@gmail.com';

  if grillo_id is null then
    raise exception 'grilloadebiyi@gmail.com has not accepted the Desk invite yet. Push this migration again once they have.';
  end if;

  insert into staff_mailboxes (user_id, address) values (grillo_id, 'grillo@brandgauge.app')
  on conflict (address) do nothing;
end $$;
