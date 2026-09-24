# RentHub V14 — Supabase-only mode

This version has **no application use of localStorage, sessionStorage, or IndexedDB**.
All RentHub records are loaded from and saved to Supabase. All uploaded photos are stored in Supabase Storage.

## 1. Run the SQL

Open Supabase → SQL Editor and run:

`SUPABASE-REMOTE-ONLY.sql`

The SQL creates the remote login-session RPC functions and the required RLS policies for the current browser client.

## 2. Storage

Create a public bucket named `renthub-images`, or use the Storage policies from your previous RentHub setup. The browser uploads only optimized JPEG files to this bucket.

## 3. Existing browser data

V14 deliberately does not read old local RentHub data. Existing `localStorage`/IndexedDB records from older versions are therefore ignored. Re-enter or re-upload any records that existed only in an older browser build.

## 4. Admin login

On the first run, the Admin login page writes the admin username/password into the Supabase `rent_hub_state` record. Subsequent login creates a short-lived server-side session in `rent_hub_sessions`. The session token is passed between portal pages in the URL; it is not stored in browser storage.

## 5. Landlords and agents

Approval records and their passwords remain in the shared Supabase state. Their portal sessions are created by the same server-side RPC mechanism.

## 6. Important security note

This is a compatibility migration of the existing RentHub data model. For a production deployment, move passwords into Supabase Auth and replace the single JSON state record with normalized tables and role-based RLS. Do not add a Supabase service-role key to the website.
