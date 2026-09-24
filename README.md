# RentHub — Rental Marketplace

RentHub is a multi-page rental marketplace with public listings, tenant applications, Company Admin, Landlord and Agent portals.

## Current architecture

This build is **Supabase-ready and multi-device capable**:

- PostgreSQL shared state through Supabase
- Supabase Storage for listing photos
- LocalStorage/IndexedDB fallback for offline/local operation
- Existing pages remain normal HTML/CSS/JavaScript — no build step required

## Supabase files

- `supabase-config.js` — browser-safe Supabase project URL and publishable key
- `supabase-schema.sql` — database table, RLS and Storage setup
- `SUPABASE-SETUP.md` — step-by-step setup and testing

Run `supabase-schema.sql` once in the Supabase SQL Editor before using the shared backend.

## Browser

For local testing, serve the folder through HTTP:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080/`.

## Security

The current compatibility build synchronizes the existing client-side portal model. Its RLS policies allow browser synchronization so the prototype works across devices. They are not a production authorization model.

For production, use Supabase Auth and role-based RLS for Admin, Landlord, Agent and Tenant access. Never put a Supabase secret/service-role key in the browser.
