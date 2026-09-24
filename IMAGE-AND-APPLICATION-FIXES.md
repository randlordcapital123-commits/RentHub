# RentHub Image + Application Fixes

## Images across devices

This version stores uploaded listing photos in Supabase Storage under `renthub-images` and saves only the public Supabase URL in the shared `rent_hub_state` record. The public marketplace reads those URLs directly, so the image is not tied to the browser that uploaded it.

Run `SUPABASE-IMAGE-POLICY-FIX.sql` once in Supabase SQL Editor. The bucket must be public for anonymous visitors to read listing photos.

**Important:** photos previously saved as `local:...` or browser-only data cannot be displayed on another device. Re-upload those old photos from Admin after installing this version. New uploads use Supabase Storage.

## Application number

New tenant applications use:

`CONTACT_NUMBER@INITIALS`

Example:

`0710753857@AJS`

The internal database ID is still kept separately so changing the display reference does not break relationships. The public status checker accepts the new application number.

Landlord and agent applications use the same reference format.

## Performance

- Supabase JavaScript CDN dependency removed from pages.
- REST API is used directly.
- Supabase requests time out quickly instead of blocking the UI.
- Images are resized/compressed before upload.
- Listing images are loaded lazily.
