-- Add address column and rename cultural_zone to lga
alter table ooh_sites add column if not exists address text;
alter table ooh_sites rename column cultural_zone to lga;
alter table ooh_sites add column if not exists traffic_ai_estimated boolean default false;
