-- RentHub Supabase compatibility schema
-- Run this once in Supabase SQL Editor.
-- The browser app stores its canonical state in one JSONB row so the existing
-- multi-page application can be synchronized without rewriting every screen.

create table if not exists public.rent_hub_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.rent_hub_state enable row level security;

drop policy if exists "RentHub state read" on public.rent_hub_state;
drop policy if exists "RentHub state insert" on public.rent_hub_state;
drop policy if exists "RentHub state update" on public.rent_hub_state;

-- This compatibility build still uses the app's existing client-side portal login.
-- Therefore the policies below allow the publishable/anon client to synchronize
-- the state. Do NOT treat this as production authorization. Before public launch,
-- replace these policies with Supabase Auth role-based policies.
create policy "RentHub state read"
  on public.rent_hub_state for select
  to anon, authenticated
  using (id = 'main');

create policy "RentHub state insert"
  on public.rent_hub_state for insert
  to anon, authenticated
  with check (id = 'main');

create policy "RentHub state update"
  on public.rent_hub_state for update
  to anon, authenticated
  using (id = 'main')
  with check (id = 'main');

-- Storage bucket for property/unit photos.
insert into storage.buckets (id, name, public)
values ('renthub-images', 'renthub-images', true)
on conflict (id) do update set public = true;

-- Public reads are needed because marketplace images are public listing assets.
drop policy if exists "RentHub images public read" on storage.objects;
create policy "RentHub images public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'renthub-images');

-- Compatibility upload policy for the current browser-only admin/landlord login.
-- Replace with authenticated role policies when Supabase Auth is enabled.
drop policy if exists "RentHub images upload" on storage.objects;
create policy "RentHub images upload"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'renthub-images');

drop policy if exists "RentHub images update" on storage.objects;
create policy "RentHub images update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'renthub-images')
  with check (bucket_id = 'renthub-images');

drop policy if exists "RentHub images delete" on storage.objects;
create policy "RentHub images delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'renthub-images');
