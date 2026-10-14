# Current setup state

## Latest state — demo reset, 14 October 2026

The owner-requested reset supersedes the earlier account/data statements below. Previous Auth users and sessions, business records, invitations and share links were removed from Travel OS only. The hosted project now contains fictional demo history: 44 leads, 23 Trips, 301 tasks, 183 transactions, 161 budgets, 32 documents and 921 marked fixture audit events. Seven passwordless, banned fictional staff rows support assignments and history; **no active admin exists**. Create a confirmed real Auth user and run `supabase/bootstrap-first-admin.sql` after replacing `YOUR_EMAIL`. See [Demo data](DEMO-DATA.md) for the coverage matrix, local share URLs and validation. Schema, RLS, deployed functions, workspace settings and disabled legacy snapshot gate were preserved. Code changes remain local and uncommitted.

## Earlier setup history

Travel OS (giomytbyuosmdljzslmk) is ACTIVE_HEALTHY in nouseeme's Org, Singapore. Existing unrelated projects were not modified.

Core, P1 configuration/analytics, share-snapshot, hosted-hardening and manual-invitation migrations are applied. Workspace/categories are seeded without synthetic business records. The ignored .env.local uses the project's publishable key; no server secret is stored locally. The invitation Edge Function is deployed with explicit caller verification and active-admin authorization. The first manually created, confirmed Auth user is activated as Noufal Rizka's administrator membership.

Public signup and anonymous sign-ins are disabled. Site URL is http://127.0.0.1:3000; the local callback allowlist is configured. The owner chose manual invitation delivery, with email/SMTP deferred. People creates an activation link for the owner to copy/send; passwords are chosen by recipients. Email recovery is off and directs the user to the admin/project owner.

Hosted checks pass for disabled signup, anonymous Data API/internal RPC denial, sharing gate denial and unauthenticated Edge rejection. Controlled user-scoped hosted queries validate admin configuration, Calendar and comparison, without adding business data. These SQL checks are not end-to-end Auth/browser tests.

The development preview is reachable at http://127.0.0.1:3000. The user signed in and approved browser inspection. After a server restart and reopened tab, navigation works. Calendar persistence, Sales analytics, Finance comparison, configuration and live audit rendering were checked. Narrow-screen Calendar was reviewed at 390 px without horizontal overflow; responsive view switches were fixed. The requested manual invitation for work@noufalriz.me was generated successfully. The user opened it privately, chose a password, activated membership, and confirmed Home-only navigation, matching its default no-module privileges. Supabase confirms the invitation is accepted.

The owner removed the PRD's three-user cap. The database command and UI now allow more members, while duplicate-invitation and last-admin protections remain. The change is recorded in a separate migration and tested beyond three users. Full permission regression, race tests, hosting and backup/restore remain pending. Sharing is off in app and database until Gate C. P2 is outside this pass.

## 14 October 2026 update

The UTC/local-timezone migration and approved P2 first-batch migration are applied. Four default Trip stages and one default open stage exist; there are no test budget rows in the hosted project. Trip stages and budgets have RLS; anonymous grants are denied. Tiptap WYSIWYG is wired to Notes, Markdown templates and itinerary descriptions. Budget vs actual is available in Finance and each Trip's Finance tab. Audit history adds local-date, actor and exact-action filters plus readable field diffs. The preview restarted and browser inspection recovered. No Vercel deployment or unrelated Supabase project change was made. See RELEASE.md for validation and remaining release gates.

# Workspace refinements update — 14 October 2026

The owner approved `workspace_refinements_internal_docs`; it is applied and recorded as `20261014150000`. Trips have three active board stages and terminal archive outcomes, with a working one-minute H−2 Cron job. IDR storage supports two decimals, historical notes are retained, and corrections require administrator confirmation. Docs/template/share tables and permissions are available. Existing admins have Docs edit; existing members default to none until assigned. Trip public sharing retains its earlier gate; explicitly published Docs snapshots use their own view-only workflow.

Production build, local/database regression, hosted deny checks and rollback-only hosted workflow checks passed. Browser verification used unsaved forms/drafts and left no synthetic business data. Code remains local/uncommitted. See [WORKSPACE-REFINEMENTS.md](WORKSPACE-REFINEMENTS.md).

## Live Trip sharing update

Live Trip sharing is now enabled through a separate capability-based path, with per-link Hidden/Viewer/Editor tabs, Public tasks, and pending Finance submissions approved by Finance editors with Trip access. Contacts use a compact name/telephone-email/note table. Refresh uses fixed toast notifications. Both migrations are applied. Earlier statements about disabled sharing refer to the legacy static Trip snapshot path. See [Trip sharing](TRIP-SHARING.md) for changed files, validation and remaining hosting checks.
