# Database migrations and release procedure

This repository uses ordered SQL files in `supabase/migrations/`. Preserve filenames and applied migration contents. Fix an applied migration with a new forward migration, rather than changing its history. New/unapplied migrations must pass both a clean-schema run and a populated-data upgrade before release.

## Current release sequence

| Order | Migration | Change | Data impact |
| --- | --- | --- | --- |
| 1 | `20261026120000_trip_board_sort_filters.sql` | Trips filters and departure/name order before pagination | Replaces guarded query fragments; no business-row deletion. |
| 2 | `20261028082008_reusable_short_share_links.sql` | Recoverable short sharing URLs and hard revocation | Adds private capability aliases. Removes already revoked sharing rows and their obsolete snapshots. Preserves finance submissions with `link_id = NULL`, ledger entries, audit events, and login invitations. |
| 3 | `20261028084809_kanban_manual_order.sql` | Personal card ordering and atomic cross-group moves | Adds `board_orders` to existing owner-scoped preferences. Preserves the saved Trip board/calendar view. Rebinds command/read wrappers and guards each patched query anchor. |

The Kanban migration depends on the sorting migration's query shape and on all earlier wrappers. Do not skip an intervening migration, squash the files, or silently ignore a failed anchor check. `board_orders` stores UUIDs by board and column; it does not grant access to the corresponding records.

The sharing migration keeps legacy URLs usable. New links store their issued capability privately; old hash-only records receive a random alias. Both forms resolve to the same permissions, expiry, locks, and rate budget. Revoke removes the capability record, so neither form can regain access.

## Preflight

1. Identify the intended project from the configured Supabase URL. Verify that the connected account can read its migration history. Do not choose a different accessible project as a substitute.
2. Compare remote history with local filenames and inspect the actual function definitions, constraints, triggers, and grants. A history/schema mismatch needs investigation before any write; do not use migration repair to mark unapplied SQL as complete.
3. Confirm an available recovery point and its restoration procedure. Count revoked sharing rows and dependent snapshots, finance submissions by status, posted transactions, audit events, invitations, and preferences. Keep evidence private and exclude token values, URLs, payloads, and credentials from logs.
4. Run `npm run typecheck`, `npm test`, and `npm run db:test`. The database suite creates isolated PGlite databases and does not use the configured hosted credentials. Its populated migration checks cover old capabilities, preserved financial history, saved preferences, and schema-drift rollback.
5. Prepare the matching application release. The short-link handlers require migration 2; Kanban ordering requires migration 3. Apply the database changes before releasing the matching application. Do not convert existing editor templates as part of this database rollout; that has a separate renderer-first procedure in README.

## Apply

Use one migration operator and a runner that records migration history and executes each file transactionally. Discover the installed CLI's current commands with `--help`; link only the verified project, review its pending migration/dry-run output, then apply missing files in timestamp order. A Supabase management connection may also apply the exact reviewed file through its migration operation.

Do not execute the same file through both runners. Do not replay seed/reset scripts on a populated production project. Do not expose the `private` schema or broaden table/function grants to work around a failed migration. Stop on an unexpected history entry, schema anchor, lock, or permission error.

## Verify after application

- Compare history and inspect the expected functions/columns, foreign keys, triggers, RLS, and grants. Anonymous callers must still be denied management RPCs and preference access.
- Confirm revoked rows are gone from `private.share_links`, `private.doc_share_links`, `private.contact_share_links`, and `private.trip_access_links`; dependent revoked static snapshots must also be gone.
- Compare financial/audit/invitation baselines. Finance submissions must remain in all statuses; those attached to deleted links must have a null link reference. Invitation rows and Auth users must remain unchanged.
- Check an existing active URL and its short alias, then use disposable test links to verify expiry and revocation. Confirm editors can recover URLs while unauthorized/public callers cannot list them. Never print the capabilities in a test transcript.
- Verify Trip name/date sorts, same-group vertical moves, cross-group moves, rejection of stale/unauthorized moves, and ordering before pagination. Reload and sign in as another authorized member to verify that personal ordering stays separate.
- Run `npm run hosted:test` against the intended project and browser acceptance against the matching application release. That script checks public access boundaries; it does not prove authenticated ordering, performance, or backup recovery by itself.

## Recovery

A failure inside a transaction must roll back that file's DDL, data changes, and function rebindings. The Kanban upgrade test deliberately breaks a query anchor and checks that no preference column or renamed wrapper remains after rollback. Do not continue with a partially applied manual SQL batch.

After a successful sharing cleanup, old revoked capability rows and snapshot payloads cannot be reconstructed from audit events. Recover them only from the verified backup if that is actually required; do not reactivate deleted URLs. Rolling back application code does not restore deleted data. Keep the additive database changes when rolling back the app unless a separately reviewed forward migration is needed.

## Operator status — 28 October 2026

Documentation/migration cleanup passed type checking, design-sidecar consistency, local documentation-link validation, 60 application tests, and 62 database scenarios. Populated migration checks also passed: all three Kanban query-anchor drift cases rolled back cleanly; the successful upgrade retained business rows, audit events, revoked login invitations, and the saved calendar preference. The earlier feature release also passed a Webpack production build and isolated desktop browser interaction checks.

Hosted history/application is **not verified**: the connected Supabase account denied history access to the project configured for Travel OS, and the CLI reported no login token. No production migration was attempted. Restore access to that same project, then restart at Preflight; local success and Git commits do not establish hosted state.
