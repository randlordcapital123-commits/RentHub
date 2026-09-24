# RentHub V15 — Supabase setup

## Install

Run **`supabase-schema.sql`** in the Supabase SQL Editor.

Run it as one script. It is idempotent and contains the database, session RPCs, RLS policies, Storage bucket and initial state row required by the V15 browser app.

You do **not** need to run `SUPABASE-SYNC-FIX-V13.sql` or `SUPABASE-IMAGE-POLICY-FIX.sql` after it.

## Verify

The SQL script ends with two verification queries:

- the `rent_hub_state` row with `id = main`
- the `renthub-images` Storage bucket

Then upload the website and open the public homepage.

## Required browser files

Every page loads:

1. `supabase-config.js`
2. `data.js`
3. its page-specific JavaScript, where applicable

All relative script, stylesheet and image references in this package resolve to files inside the package.

## If Supabase is unavailable

The application does not silently switch to browser storage. It displays a connection error instead, because V15 is deliberately Supabase-only.

## Security

The browser uses only a publishable/anon key. Never place a Supabase service-role or secret key in `supabase-config.js`.

The current compatibility RLS model is intentionally permissive so the existing browser portal can synchronize data. Replace it with Supabase Auth and role-based RLS before using the system for sensitive production data.
