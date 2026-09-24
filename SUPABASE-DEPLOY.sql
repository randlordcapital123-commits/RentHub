-- RentHub Supabase canonical deployment
-- RUN THIS FILE ONCE in the Supabase SQL Editor.
-- It is idempotent: it can safely be run again after an update.
--
-- RentHub V15 is Supabase-only. Application data, sessions and listing photos
-- are stored remotely. Do not run the older SQL files in a different order.

create extension if not exists pgcrypto;

-- 1) Canonical application state
create table if not exists public.rent_hub_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.rent_hub_state enable row level security;

drop policy if exists "RentHub state read" on public.rent_hub_state;
drop policy if exists "RentHub state insert" on public.rent_hub_state;
drop policy if exists "RentHub state update" on public.rent_hub_state;
drop policy if exists renthub_state_anon_select on public.rent_hub_state;
drop policy if exists renthub_state_anon_insert on public.rent_hub_state;
drop policy if exists renthub_state_anon_update on public.rent_hub_state;

create policy renthub_state_anon_select
on public.rent_hub_state for select
to anon using (id='main');

create policy renthub_state_anon_insert
on public.rent_hub_state for insert
to anon with check (id='main');

create policy renthub_state_anon_update
on public.rent_hub_state for update
to anon using (id='main') with check (id='main');

-- 2) Server-side portal sessions
create table if not exists public.rent_hub_sessions (
  token_hash text primary key,
  role text not null check (role in ('admin','landlord','agent')),
  user_id text not null,
  expires_at timestamptz not null default (now() + interval '8 hours'),
  created_at timestamptz not null default now()
);

alter table public.rent_hub_sessions enable row level security;
revoke all on public.rent_hub_sessions from anon, authenticated;

create or replace function public.renthub_login(p_role text, p_identifier text, p_password text)
returns table(token text, user_id text, role text)
language plpgsql security definer set search_path=public
as $$
declare d jsonb; arr jsonb; found_id text; stored_pass text; stored_user text;
        raw_token text; hash text;
begin
  select data into d from public.rent_hub_state where id='main';
  if d is null then raise exception 'RentHub data is not initialized'; end if;

  if p_role='admin' then
    stored_user:=d->'settings'->>'username';
    stored_pass:=d->'settings'->>'password';
    found_id:='admin';
    if coalesce(stored_user,'')<>trim(p_identifier)
       or coalesce(stored_pass,'')<>p_password then
      raise exception 'Invalid credentials';
    end if;

  elsif p_role='landlord' then
    arr:=coalesce(d->'landlords','[]'::jsonb);
    select x->>'id', x->>'password' into found_id, stored_pass
    from jsonb_array_elements(arr) x
    where upper(coalesce(x->>'status',''))='APPROVED'
      and regexp_replace(coalesce(x->>'phone',''),'\D','','g')
        = regexp_replace(trim(p_identifier),'\D','','g')
    limit 1;
    if found_id is null or coalesce(stored_pass,'')<>p_password then
      raise exception 'Invalid credentials';
    end if;

  elsif p_role='agent' then
    arr:=coalesce(d->'agents','[]'::jsonb);
    select x->>'id', x->>'password' into found_id, stored_pass
    from jsonb_array_elements(arr) x
    where upper(coalesce(x->>'status',''))='APPROVED'
      and regexp_replace(coalesce(x->>'phone',''),'\D','','g')
        = regexp_replace(trim(p_identifier),'\D','','g')
    limit 1;
    if found_id is null or coalesce(stored_pass,'')<>p_password then
      raise exception 'Invalid credentials';
    end if;
  else
    raise exception 'Invalid role';
  end if;

  raw_token:=encode(gen_random_bytes(32),'hex');
  hash:=encode(digest(raw_token,'sha256'),'hex');
  delete from public.rent_hub_sessions where expires_at < now();
  insert into public.rent_hub_sessions(token_hash,role,user_id)
  values(hash,p_role,found_id);
  return query select raw_token,found_id,p_role;
end $$;

create or replace function public.renthub_validate_session(p_token text)
returns table(valid boolean, user_id text, role text)
language plpgsql security definer set search_path=public
as $$
declare h text;
begin
  h:=encode(digest(coalesce(p_token,''),'sha256'),'hex');
  delete from public.rent_hub_sessions where expires_at < now();
  return query
    select true,s.user_id,s.role
    from public.rent_hub_sessions s
    where s.token_hash=h and s.expires_at>now()
    limit 1;
  if not found then
    return query select false,null::text,null::text;
  end if;
end $$;

create or replace function public.renthub_logout(p_token text)
returns boolean
language plpgsql security definer set search_path=public
as $$
begin
  delete from public.rent_hub_sessions
  where token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex');
  return true;
end $$;

grant execute on function public.renthub_login(text,text,text) to anon, authenticated;
grant execute on function public.renthub_validate_session(text) to anon, authenticated;
grant execute on function public.renthub_logout(text) to anon, authenticated;

-- 3) Storage is managed by Supabase and is NOT modified by this SQL.
-- Create a public bucket named "renthub-images" from Supabase Dashboard:
-- Storage -> New bucket -> Name: renthub-images -> Public: ON.
-- This avoids touching the managed storage.objects table, which causes
-- "must be owner of table objects" errors in some Supabase projects.

-- 4) Initialize the canonical row if it does not exist.
insert into public.rent_hub_state(id,data)
values ('main', jsonb_build_object(
  'brandName','RentHub','contact','',
  'properties','[]'::jsonb,'rooms','[]'::jsonb,'applications','[]'::jsonb,
  'landlords','[]'::jsonb,'agents','[]'::jsonb,'rentals','[]'::jsonb,
  'payments','[]'::jsonb,'commissions','[]'::jsonb,'payouts','[]'::jsonb,
  'documents','[]'::jsonb,'notifications','[]'::jsonb,'auditLogs','[]'::jsonb,
  'settings',jsonb_build_object('username','','password','')
))
on conflict (id) do nothing;

-- Verification
select id, updated_at,
  jsonb_array_length(coalesce(data->'properties','[]'::jsonb)) as property_count,
  jsonb_array_length(coalesce(data->'rooms','[]'::jsonb)) as room_count
from public.rent_hub_state where id='main';

-- Storage bucket check is intentionally omitted because storage.buckets is managed by Supabase.
