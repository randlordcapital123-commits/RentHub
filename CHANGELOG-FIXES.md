# RentHub V8 — Fix Pass

## Core blockers fixed

1. Tenant applications now open a real application form, validate the phone number, create an application record, prevent duplicate active applications for the same tenant/room, show a reference, and support the Check Application section.
2. Landlord dashboard and payout pages no longer execute code that assumes `addRoomBtn` exists. Each portal page now renders its own content.
3. `data.rooms` is the canonical room source. Admin property/unit changes update the same room records used by the public marketplace.
4. Landlord-created rooms are stored in the same canonical room collection and are visible to Admin.
5. Assigning a landlord to a property propagates the assignment to its rooms, so the landlord portal sees them.

## Data integrity / workflow fixes

12. Audit logging is centralized through `Store.log()`, which writes the log and notification and persists them itself.
13. Room edit forms preselect the saved type and availability.
14. Landlord edits preserve company pricing and approval state. New landlord rooms start hidden until admin approval.
15. Local mode refreshes from storage when another tab changes the data and before page rendering. This reduces stale-tab problems; a hosted backend is still required for transactional multi-user writes.
16. JSON load is protected by parsing guards and storage writes have error handling. Images are isolated from the main JSON blob.
17. First-run admin setup requires a non-empty username and an 8+ character password. Changing credentials requires confirmation.
18. Unsaved room forms do not write their text fields into the saved record.
19. New/unsaved room photo removal is no longer presented as a no-op.
20. Reset clears local records, image previews, image storage and browser sessions.

## Business-logic fixes

21. Occupied or hidden rooms cannot be applied for or approved. Approval checks that no active rental already exists.
22. Ledger records require meaningful amounts where an amount is applicable and use stable IDs for landlords/agents instead of names.
23. New landlord/agent/tenant applications create notifications and audit entries in local mode.
24. Agent commissions use `agentId` rather than agent-name matching.
25. Fresh installs no longer seed public demo properties. Contact information starts blank instead of showing a fake contact.
26. Public landlord/agent applications validate phone numbers and prevent duplicate applications for the same phone.

## Polish

- Mobile menu icon has actual hamburger CSS and an accessible screen-reader label.
- Escape closes open modals.
- Existing room photos can be removed from admin/landlord photo management.
- Form controls use visible labels in the new management forms.

## Important production limitation

Items 6–11 cannot be made genuinely secure or multi-device by front-end JavaScript alone. This package therefore does not falsely claim that localStorage is a secure backend. See `BACKEND-SETUP.md` for the production architecture required for real cross-device users, authentication, uploads and authorization.
