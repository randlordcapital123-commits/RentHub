# Supabase-only deployment

Use `SUPABASE-REMOTE-ONLY.sql` in the Supabase SQL Editor before opening the site.

RentHub V14 does not use localStorage, sessionStorage or IndexedDB for application data, photos, or sessions. Persistent data is stored in Supabase and photos are stored in the `renthub-images` Storage bucket.
