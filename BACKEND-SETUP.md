# RentHub backend / production note

This ZIP fixes the application and data-model bugs in the browser version, but **localStorage/IndexedDB cannot provide real multi-device storage or server-side security**. A production marketplace must connect these records to a backend.

## What is fixed in this build
- Tenant room application workflow and application reference/status check.
- Applications create records and admin approval creates one active rental and marks the room occupied.
- One canonical `data.rooms` collection. Property `roomIds` are metadata only; old `properties[].units` data is migrated once.
- Admin edits, prices, photos, approval and availability are reflected by the public listing.
- Property deletion removes its rooms from the public marketplace.
- Landlord assignment propagates to the rooms, so assigned landlords see them.
- Landlord dashboard and payouts pages no longer depend on an Add Room button existing on every page.
- Room edit forms preserve type and availability.
- Landlord-created rooms start hidden/pending approval.
- Audit logs/notifications are saved by the logging operation itself, so save-before-log ordering cannot lose them.
- Defensive JSON loading and storage-error handling.
- Photo storage is isolated in IndexedDB, with preview cleanup and object-URL cleanup support.
- Reset clears local records, image previews, image database and sessions.
- Financial records use stable `agentId` / `landlordId` fields rather than matching names.
- Public applications validate phone numbers and block duplicate active applications for the same tenant/room.
- Occupied/hidden rooms cannot be approved for a new rental.
- Seed/demo listings were removed from fresh installs.
- Admin first-run credentials are created in the browser instead of shipping a hardcoded admin password in the UI.

## Production requirement

For real tenants, landlords and agents using different phones/computers, connect `Store` to a server API/database and move authentication to the server. Do **not** use phone numbers as passwords and do not trust a localStorage session for authorization.

The clean production schema should have separate tables/collections for:

- users/auth accounts
- landlords
- agents
- properties
- rooms
- tenants
- applications
- rentals
- payments
- commissions
- payouts
- documents
- notifications
- audit_logs
- property/room images in object storage

Each room should have a stable ID and foreign keys to its property and landlord. Applications and rentals should reference `room_id`; commissions and payouts should reference `agent_id` / `landlord_id`.

### Recommended deployment pattern

1. Use a real authentication provider (for example Supabase Auth or a server-side session system).
2. Store marketplace records in a hosted database.
3. Store room/property photos in object storage, not localStorage.
4. Enforce role-based access in database/API rules, not only in JavaScript.
5. Use row-level authorization so a landlord can read/write only their rooms and payouts.
6. Make application approval transactional: verify room is available, create rental, mark room occupied, and prevent a second active rental.
7. Send approval/rejection/application notifications through the backend.
8. Keep an immutable audit log for financial and access-sensitive operations.
