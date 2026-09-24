RENT HUB - SUPABASE ONLY

1. Run SUPABASE-DEPLOY.sql once in Supabase SQL Editor.
2. In Supabase Dashboard > Storage, create a PUBLIC bucket named renthub-images.
3. Upload the rental_app folder to your web host/GitHub.

This build does not use localStorage, sessionStorage, IndexedDB, or a browser database.
Application records are stored in public.rent_hub_state.
Portal sessions are stored in public.rent_hub_sessions.
Images are stored in Supabase Storage bucket renthub-images.

Do not run older RentHub SQL files together with this deployment.
