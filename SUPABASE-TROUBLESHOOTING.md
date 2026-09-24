# RentHub Supabase troubleshooting

## If Admin says Loading…

This build has a 7-second Supabase timeout. The admin UI must continue loading even when Supabase is unreachable. If it says **Using local cache — Supabase unavailable**, check:

1. Supabase project is running.
2. `rent_hub_state` exists.
3. `rent_hub_state` has RLS enabled with SELECT/INSERT/UPDATE policies for `anon` and `authenticated`.
4. The Storage bucket `renthub-images` exists.
5. The browser can reach `https://peldlsieazqvmujmegjs.supabase.co`.
6. Run `supabase-schema.sql` again if the table/policies are missing.

## If Approve does nothing

Open Admin → Landlords or Agents. Pending records now have explicit Approve/Reject actions. Approval generates a temporary portal password and persists the status to the shared Supabase state.

For tenant applications, Admin → Applications → Approve checks that the room is still approved, available and not already rented, then marks it occupied and creates the rental.

## Important

This compatibility version stores the app state in one JSONB row. It is suitable for getting the existing application synchronized across devices, but it is not the final production authorization architecture. For production, migrate users to Supabase Auth and separate tables with role-based RLS.
