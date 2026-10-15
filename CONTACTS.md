# Shared contact storage

`public.contacts` stores one contact per row, scoped to a workspace. Fields include UUID, name, phone, email, organization, role, note, version and timestamps. Normalized names are unique within a workspace, matching the existing contact-picker convention.

`public.journey_contacts` links those UUIDs to CRM leads and Trips (`public.journeys`). Each link has an order; composite foreign keys prevent links across workspaces. Conversion keeps the same contact UUIDs in both the archived lead and the new Trip. No separate project entity currently exists.

Journey detail responses still expose a `contacts` array for the UI, assembled from these tables. Persisted `journeys.data.contacts` is always empty. `private.internal_contacts` is now a compatibility view, not a data store. `private.contact_directory_state` holds the optimistic version used when adding Internal contacts.

## Editing and access

- Internal → Contacts lists the canonical directory. Add creates a database record; row Edit changes that record everywhere; bulk Delete removes it and all its links atomically.
- Trip/CRM contact forms can link saved contacts, create new contacts and unlink rows. Changing an existing contact requires Internal edit permission and its current contact version.
- Shared edits invalidate all linked journey versions, including archives, so an old open form cannot overwrite the change. Batch deletion validates every record and rolls back on a stale/missing entry.
- Table reads use RLS. Internal readers can see the directory; other module readers see contacts linked to accessible journeys. Link reads expose only accessible parents. All application writes use audited command functions; direct table writes are denied.
- Bearer links see only their Trip's contacts. They can create/unlink contacts and edit a contact exclusive to that Trip. Editing a shared or Internal contact requires Internal edit access. Token revocation, tab permissions, lifecycle and parent versions are checked before writes.
- Published snapshots remain frozen during ordinary edits. The explicit demo reset clears their old contact copies and revokes old directory-share links.

## Requested demo reset

Apply `supabase/migrations/20261015090137_shared_contacts_relational.sql` after the existing migrations, including `contact_name_index_bulk_actions`. The structural migration normalizes existing data. Then run `supabase/reset-contacts.sql` as the database owner.

The reset transaction targets only workspace `10000000-0000-4000-8000-000000000001`, verifies its name is Travel OS, removes its old contact records and snapshot copies, redacts contact-specific audit payloads, and creates 24 fictional contacts. Each existing CRM/Trip gets three links, including archived records. A converted lead and its Trip share the same three contacts. Names, notes, itineraries, tasks, finance and other workspace contacts are retained. Dummy emails use `example.test`; phone fields are blank.

This script is intentionally destructive and repeatable: rerunning it resets contacts again. It is separate from the structural migration so ordinary schema setup does not reset business data.

## Verification

`npm run db:test` exercises canonical storage, shared edits, optimistic conflicts, conversion identity, independent unlinking, atomic deletion, module isolation, public-link isolation, cross-workspace foreign keys and the scoped demo reset. A populated migration fixture verifies legacy normalization and preservation of non-contact journey fields. `npm test`, `npm run typecheck` and `npm run build` cover the application. Hosted application and final record counts must also be checked before claiming the live reset is complete.

## Hosted application, 15 October 2026

Applied `contact_name_index_bulk_actions`, `shared_contacts_relational`, and the scoped reset to Travel OS (`giomytbyuosmdljzslmk`). Verified 24 dummy contacts, 201 links and all 67 journeys linked, with no legacy embedded contacts or old snapshot contact copies. The content hashes of all journey details, 301 tasks and 183 transactions matched before and after the reset. A rollback-only authenticated hosted check verified directory reads, a shared contact edit, linked-parent version invalidation and rejection of a stale contact edit.

Security advisors reported no warning for the new public tables. The private state table intentionally has RLS with no direct-access policies, matching the RPC-only private tables. The existing Auth leaked-password protection warning remains unrelated to this migration.

Validation: 58 database scenarios plus both populated migration fixtures passed; 50 application tests passed; TypeScript passed; production build passed using `npm run build -- --webpack`. Default Turbopack failed while starting its CSS worker in this Windows environment. UI changes are local and have not been committed, pushed or deployed; the database migrations and reset are already applied to hosted Supabase.
