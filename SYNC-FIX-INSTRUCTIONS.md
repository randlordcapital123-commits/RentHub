# RentHub V13 — property/image synchronization fix

## Why the previous build could show an empty public site
The previous browser build could render its cached local copy while the Supabase request was still pending. A save made during that window could also fail to reach Supabase because the remote layer was not marked ready yet.

V13 changes this behavior:

- Supabase REST uses the supplied legacy `anon` key first for maximum compatibility.
- Local edits are marked as pending until the remote write succeeds.
- A remote load can no longer overwrite a property/room that was just edited locally.
- Failed/slow remote reads are retried in the background.
- The public page directly uses Supabase Storage URLs for remote photos.
- The public page refreshes when the shared Supabase state arrives.

## Run this SQL once
Open Supabase → SQL Editor and run:

`SUPABASE-SYNC-FIX-V13.sql`

Then verify the query returns a `main` row after you save a property/room from Admin.

## Important: a Property is a container
RentHub's public marketplace lists **rooms/units**, not an empty property container. After creating a property in Admin, create at least one room under that property and set:

- Publish = Approved
- Availability = Available

The public site will then display the room under that property.

## Images
Upload images from Admin → Units → Edit room. The saved image value should start with:

`https://peldlsieazqvmujmegjs.supabase.co/storage/v1/object/public/renthub-images/rooms/`

If it instead starts with `local:` or `data:`, the image was not uploaded to Supabase.

## Testing across devices
1. Run the SQL.
2. Open Admin and add a property.
3. Add a room to that property.
4. Upload one photo.
5. Save the room.
6. Refresh Admin and confirm the room remains there.
7. Open the public website in an incognito window or another phone.
8. The room and its photo should appear.
