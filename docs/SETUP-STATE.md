# Current setup state

Travel OS (giomytbyuosmdljzslmk) is ACTIVE_HEALTHY in nouseeme's Org, Singapore. Existing unrelated projects were not modified.

Core, P1 configuration/analytics, share-snapshot, hosted-hardening and manual-invitation migrations are applied. Workspace/categories are seeded without synthetic business records. The ignored .env.local uses the project's publishable key; no server secret is stored locally. The invitation Edge Function is deployed with explicit caller verification and active-admin authorization. The first manually created, confirmed Auth user is activated as Noufal Rizka's administrator membership.

Public signup and anonymous sign-ins are disabled. Site URL is http://127.0.0.1:3000; the local callback allowlist is configured. The owner chose manual invitation delivery, with email/SMTP deferred. People creates an activation link for the owner to copy/send; passwords are chosen by recipients. Email recovery is off and directs the user to the admin/project owner.

Hosted checks pass for disabled signup, anonymous Data API/internal RPC denial, sharing gate denial and unauthenticated Edge rejection. Controlled user-scoped hosted queries validate admin configuration, Calendar and comparison, without adding business data. These SQL checks are not end-to-end Auth/browser tests.

The development preview is reachable at http://127.0.0.1:3000. The user signed in and approved browser inspection. After a server restart and reopened tab, navigation works. Calendar persistence, Sales analytics, Finance comparison, configuration and live audit rendering were checked. Narrow-screen Calendar was reviewed at 390 px without horizontal overflow; responsive view switches were fixed. The requested manual invitation for work@noufalriz.me was generated successfully. The user opened it privately, chose a password, activated membership, and confirmed Home-only navigation, matching its default no-module privileges. Supabase confirms the invitation is accepted.

The owner removed the PRD's three-user cap. The database command and UI now allow more members, while duplicate-invitation and last-admin protections remain. The change is recorded in a separate migration and tested beyond three users. Full permission regression, race tests, hosting and backup/restore remain pending. Sharing is off in app and database until Gate C. P2 is outside this pass.
