-- A Supabase-shaped shim, enough for the migration set to apply.
create extension if not exists pgcrypto;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

create table if not exists auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text unique,
  raw_app_meta_data  jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Linked identities. 20260712000000 reads this to rewrite demo logins.
create table if not exists auth.identities (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  provider      text,
  identity_data jsonb default '{}'::jsonb,
  created_at    timestamptz default now()
);

-- The signed-in user, settable per session so policies can be exercised.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
$$;

create table if not exists storage.buckets (
  id    text primary key,
  name  text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now()
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text,
  owner     uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;

do $$ begin
  create role anon;            exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated;   exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role;    exception when duplicate_object then null; end $$;
do $$ begin
  create role supabase_realtime_admin; exception when duplicate_object then null; end $$;

grant usage on schema public to anon, authenticated, service_role;

-- Realtime publication, which some migrations add tables to.
do $$ begin
  create publication supabase_realtime; exception when duplicate_object then null; end $$;
