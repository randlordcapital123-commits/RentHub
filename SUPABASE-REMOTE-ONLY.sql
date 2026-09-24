-- RentHub V14: remote-only mode
-- Run in Supabase SQL Editor.
-- This removes the need for localStorage/IndexedDB for RentHub records and
-- provides server-side login sessions used through URL tokens.

create extension if not exists pgcrypto;

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
declare d jsonb; arr jsonb; item jsonb; found_id text; stored_user text; stored_pass text; raw_token text; hash text;
begin
  select data into d from public.rent_hub_state where id='main';
  if d is null then raise exception 'RentHub data is not initialized'; end if;
  if p_role='admin' then
    stored_user:=d->'settings'->>'username'; stored_pass:=d->'settings'->>'password'; found_id:='admin';
    if coalesce(stored_user,'')<>trim(p_identifier) or coalesce(stored_pass,'')<>p_password then raise exception 'Invalid credentials'; end if;
  elsif p_role='landlord' then
    arr:=coalesce(d->'landlords','[]'::jsonb);
    select x->>'id', x->>'password' into found_id, stored_pass from jsonb_array_elements(arr) x where upper(coalesce(x->>'status',''))='APPROVED' and regexp_replace(coalesce(x->>'phone',''),'\D','','g')=regexp_replace(trim(p_identifier),'\D','','g') limit 1;
    if found_id is null or coalesce(stored_pass,'')<>p_password then raise exception 'Invalid credentials'; end if;
  elsif p_role='agent' then
    arr:=coalesce(d->'agents','[]'::jsonb);
    select x->>'id', x->>'password' into found_id, stored_pass from jsonb_array_elements(arr) x where upper(coalesce(x->>'status',''))='APPROVED' and regexp_replace(coalesce(x->>'phone',''),'\D','','g')=regexp_replace(trim(p_identifier),'\D','','g') limit 1;
    if found_id is null or coalesce(stored_pass,'')<>p_password then raise exception 'Invalid credentials'; end if;
  else raise exception 'Invalid role'; end if;
  raw_token:=encode(gen_random_bytes(32),'hex'); hash:=encode(digest(raw_token,'sha256'),'hex');
  delete from public.rent_hub_sessions where expires_at < now();
  insert into public.rent_hub_sessions(token_hash,role,user_id) values(hash,p_role,found_id);
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
  return query select true,s.user_id,s.role from public.rent_hub_sessions s where s.token_hash=h and s.expires_at>now() limit 1;
  if not found then return query select false,null::text,null::text; end if;
end $$;

create or replace function public.renthub_logout(p_token text)
returns boolean
language plpgsql security definer set search_path=public
as $$
begin
 delete from public.rent_hub_sessions where token_hash=encode(digest(coalesce(p_token,''),'sha256'),'hex');
 return true;
end $$;

grant execute on function public.renthub_login(text,text,text) to anon, authenticated;
grant execute on function public.renthub_validate_session(text) to anon, authenticated;
grant execute on function public.renthub_logout(text) to anon, authenticated;

-- State table must be readable/writable by the current compatibility frontend.
alter table public.rent_hub_state enable row level security;
drop policy if exists renthub_state_anon_select on public.rent_hub_state;
drop policy if exists renthub_state_anon_insert on public.rent_hub_state;
drop policy if exists renthub_state_anon_update on public.rent_hub_state;
create policy renthub_state_anon_select on public.rent_hub_state for select to anon using (true);
create policy renthub_state_anon_insert on public.rent_hub_state for insert to anon with check (id='main');
create policy renthub_state_anon_update on public.rent_hub_state for update to anon using (id='main') with check (id='main');


-- Storage: public listing images can be viewed by visitors; browser client can upload/update/delete
-- using the current compatibility model. Tighten these policies when Supabase Auth roles are deployed.
insert into storage.buckets (id,name,public) values ('renthub-images','renthub-images',true) on conflict (id) do update set public=true;
drop policy if exists renthub_images_public_read on storage.objects;
drop policy if exists renthub_images_anon_insert on storage.objects;
drop policy if exists renthub_images_anon_update on storage.objects;
drop policy if exists renthub_images_anon_delete on storage.objects;
create policy renthub_images_public_read on storage.objects for select using (bucket_id='renthub-images');
create policy renthub_images_anon_insert on storage.objects for insert to anon with check (bucket_id='renthub-images');
create policy renthub_images_anon_update on storage.objects for update to anon using (bucket_id='renthub-images') with check (bucket_id='renthub-images');
create policy renthub_images_anon_delete on storage.objects for delete to anon using (bucket_id='renthub-images');
