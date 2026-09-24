-- RentHub V13 synchronization fix
-- Run once in Supabase SQL Editor.
-- This is for the current browser-compatible RentHub architecture.

create table if not exists public.rent_hub_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.rent_hub_state enable row level security;

drop policy if exists "RentHub state read" on public.rent_hub_state;
drop policy if exists "RentHub state insert" on public.rent_hub_state;
drop policy if exists "RentHub state update" on public.rent_hub_state;

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

insert into storage.buckets (id, name, public)
values ('renthub-images', 'renthub-images', true)
on conflict (id) do update set public = true;

alter table storage.objects enable row level security;

drop policy if exists "RentHub public image read" on storage.objects;
drop policy if exists "RentHub image upload" on storage.objects;
drop policy if exists "RentHub image update" on storage.objects;
drop policy if exists "RentHub image delete" on storage.objects;

create policy "RentHub public image read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'renthub-images');

create policy "RentHub image upload"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'renthub-images');

create policy "RentHub image update"
on storage.objects for update
to anon, authenticated
using (bucket_id = 'renthub-images')
with check (bucket_id = 'renthub-images');

create policy "RentHub image delete"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'renthub-images');

-- Verify the two things the browser needs:
select id, updated_at, jsonb_array_length(coalesce(data->'properties','[]'::jsonb)) as property_count,
       jsonb_array_length(coalesce(data->'rooms','[]'::jsonb)) as room_count
from public.rent_hub_state
where id = 'main';

select id, name, public
from storage.buckets
where id = 'renthub-images';
