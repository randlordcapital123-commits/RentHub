# RentHub + Supabase setup

This version is wired to the supplied Supabase project and uses:

- Supabase Postgres for the shared RentHub data state
- Supabase Storage bucket `renthub-images` for room/property photos
- LocalStorage/IndexedDB only as an offline fallback/cache
- The Supabase publishable key in `supabase-config.js`

## 1. Run the SQL

Open your Supabase project → **SQL Editor** → create a new query → paste the complete contents of:

`supabase-schema.sql`

Run it once.

The SQL creates:

- `public.rent_hub_state`
- Row Level Security policies for that table
- `renthub-images` Storage bucket
- Storage policies for public listing images and browser uploads

If you already created a different RentHub table, do not delete it. This build uses `rent_hub_state` specifically so the existing application can be synchronized without rewriting every page.

## 2. Confirm the bucket

Go to **Storage** and confirm a bucket named:

`renthub-images`

It is configured as a public bucket because marketplace listing photos must be visible to visitors.

## 3. Open the website

The project is still a plain HTML application. You can deploy the `rental_app` folder to normal hosting/cPanel/GitHub Pages.

For local testing, use a local HTTP server rather than opening the HTML file directly. For example, from the `rental_app` folder:

```bash
python -m http.server 8080
```

Then open:

`http://localhost:8080/`

## 4. Test multi-device sync

1. Open the public site on computer A.
2. Open Admin on computer A.
3. Create an admin account if this is a new database.
4. Add a property and one room.
5. Upload room photos.
6. Open the public site on computer B.
7. The same property, room, availability and photos should load from Supabase.
8. Submit a tenant application from computer B.
9. Refresh Admin on computer A and open Applications.
10. Approve the application and verify the room becomes occupied on computer B.

## Important security note

The current RentHub portals still use their original client-side login system. Supabase synchronization makes the data and photos shared between devices, but it does **not** turn those browser logins into server-side authentication.

The compatibility RLS policies therefore allow the browser client to read/write the shared state. This is suitable for getting the existing prototype working across devices, but it is **not the final production security model**.

For production, the next step is to migrate Admin/Landlord/Agent login to **Supabase Auth** and replace the compatibility RLS policies with role-based policies. Supabase's publishable key is designed for browser applications, while secret/service-role keys must never be placed in browser code.
