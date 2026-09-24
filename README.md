# RentHub — Rental Marketplace V15

RentHub is a multi-page rental marketplace with a public listings site plus Company Admin, Landlord and Agent portals.

## Architecture

This release is **Supabase-only**:

- PostgreSQL shared application state in `public.rent_hub_state`
- Server-side portal sessions through the `renthub_login`, `renthub_validate_session` and `renthub_logout` RPC functions
- Supabase Storage bucket `renthub-images` for listing photos
- No LocalStorage, sessionStorage or IndexedDB is used for application data, sessions or photos
- Normal HTML/CSS/JavaScript — no build step is required

The data layer keeps one stable in-memory object reference while remote data loads. This prevents public pages and dashboards from holding stale snapshots when Supabase refreshes the data.

## Supabase setup — one file only

Run **`supabase-schema.sql`** once in the Supabase SQL Editor.

That file is now the canonical, idempotent V15 deployment. It creates/updates:

1. `rent_hub_state`
2. `rent_hub_sessions`
3. `renthub_login`
4. `renthub_validate_session`
5. `renthub_logout`
6. RLS policies for the state row
7. the public `renthub-images` Storage bucket and its policies
8. the initial `main` state row

`SUPABASE-REMOTE-ONLY.sql` contains the same canonical deployment for compatibility with older deployment instructions.

The files `SUPABASE-SYNC-FIX-V13.sql` and `SUPABASE-IMAGE-POLICY-FIX.sql` are retained as historical migration references. **Do not run them as a separate installation sequence for V15.**

## Browser configuration

`supabase-config.js` contains the Supabase project URL and browser-safe key. The file is loaded before `data.js` on every page and has been syntax-validated.

The REST layer prefers the legacy `anonKey` when present for compatibility and falls back to `publishableKey`.

Never put a Supabase service-role/secret key in this file.

## Local testing

Serve the folder through HTTP:

```bash
python -m http.server 8080
```

Then visit:

`http://localhost:8080/`

Do not open the HTML files directly with `file://`, because Supabase requests and browser security rules require an HTTP/HTTPS origin.

## Mobile support

The public marketplace, Admin, Landlord and Agent portals are responsive. Sidebars collapse into mobile menus, tables scroll horizontally where required, forms stack on narrow screens, images scale to the viewport, and login screens support small phones and landscape orientation.

## Important security note

The current browser compatibility model intentionally permits anonymous synchronization of the single state row and browser image uploads. This is suitable for the current prototype/compatibility architecture, but it is **not a production authorization model**. For production, migrate portal identity and authorization to Supabase Auth with role-based RLS.
