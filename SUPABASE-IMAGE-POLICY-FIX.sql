-- RentHub image storage fix
-- Run once in Supabase SQL Editor.
-- The marketplace must be able to READ listing images anonymously.
-- RLS on storage.objects remains enabled; these policies control access.

insert into storage.buckets (id, name, public)
values ('renthub-images', 'renthub-images', true)
on conflict (id) do update set public = true;

alter table storage.objects enable row level security;

drop policy if exists "RentHub public image read" on storage.objects;
drop policy if exists "RentHub image upload" on storage.objects;
drop policy if exists "RentHub image update" on storage.objects;
drop policy if exists "RentHub image delete" on storage.objects;

-- Anyone can read published RentHub listing images.
create policy "RentHub public image read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'renthub-images');

-- The current browser application uses the Supabase publishable/anon key.
-- These policies allow the application to upload images into its own bucket.
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

-- Verify the bucket is public after running this script.
select id, name, public from storage.buckets where id = 'renthub-images';
