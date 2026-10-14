# Demo reset — 14 October 2026

The hosted **Travel OS** project (`giomytbyuosmdljzslmk`) was reset at the owner's request. Previous business records, memberships, invitations, audit history, share capabilities and Auth users/sessions were removed. Schema, migrations, RLS, functions, invitation configuration, workspace origin/timezone and the existing legacy sharing gate were retained. Other Supabase projects were untouched.

The replacement is a fictional six-month history anchored on 14 October 2026. Fixture audit events are explicitly marked `demo_fixture`; they are constructed history, not proof that the UI workflows ran for six months. This is a coverage dataset for review, not an exhaustive set of every field/permission permutation or a completed application audit.

## Create the first administrator

1. Open [Travel OS Authentication → Users](https://supabase.com/dashboard/project/giomytbyuosmdljzslmk/auth/users).
2. Choose **Add user → Create new user**, enter your own email and a password you choose, and enable **Auto Confirm User**. Public signup stays disabled.
3. Open [Travel OS SQL Editor](https://supabase.com/dashboard/project/giomytbyuosmdljzslmk/sql/new). Copy `supabase/bootstrap-first-admin.sql`, replace `YOUR_EMAIL` with that exact email, and run it. Change `Noufal Rizka` in the script if you want a different display name. It grants edit access to Sales, Trips, Finance and Docs, and refuses when an active admin already exists.
4. Open http://127.0.0.1:3000/login and sign in with the new credentials. If an old session remains in your browser, sign out first. Old credentials no longer work.

The dashboard SQL method requires no secret in `.env.local`. Alternatively, if a server-only `SUPABASE_SECRET_KEY` is configured, use `npm run bootstrap -- --email YOUR_EMAIL --name "Noufal Rizka"` after manually creating the confirmed Auth user. The bootstrap script now includes Docs edit access.

There are **zero active admins** after the reset. Seven fictional Auth rows support membership foreign keys. They have no passwords or identities and are banned until 2099; their `@example.invalid` addresses cannot receive real invitations. They supply display names, permission examples and historical actors, and are not login accounts. Create real audit accounts through People invitations when testing authentication or access from multiple browsers. Do not turn the fictional rows into real users.

## Coverage

| Module        | Demo scenarios                                                                                                                                                                                                                                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home / Tasks  | Assigned, Doing, Done; internal, lead, Trip and Public tasks; overdue, due today, due soon and future; cancelled tasks; former employee reassignment; enough rows for pagination and filters                                                                                                                                       |
| Sales         | 44 leads: active Drafts/Contacted/Prospect; Lost with reasons; manual archive; 20 linked conversions; notes, contacts, three-day itinerary, quotation, guests, dates and PIC populated                                                                                                                                             |
| Trips         | 23 Trips: Planned, Confirmed, In Progress, Completed, Cancelled; future, ongoing and historical dates; individual/corporate/community/education clients; multi-person assignments; source links, transferred task history, H−2 progression history; full notes, contacts and itineraries                                           |
| Finance       | 183 transactions across six months; every default category; Trip and general cash; deposits, final payments, refunds, owner capital/withdrawals and loans; IDR decimals; posted and void; pending/approved/rejected corrections; pending/approved/rejected public submissions; positive, negative and break-even Trip cash results |
| Budgets       | 161 rows; actual above/below/equal to budget, zero budget, unbudgeted category actuals; a budget-only Trip and an unfunded Trip with no budget                                                                                                                                                                                     |
| Internal Docs | 32 documents across Operations/Finance/Meeting/Policy; Markdown headings, tables and checklists; versioned edits; active, expired, revoked and updated snapshots                                                                                                                                                                   |
| Contacts      | 18 internal contacts plus 3 contacts per journey; client/vendor roles, fictional email and notes; active, expired and revoked directory snapshots. Telephone fields are intentionally blank; no fabricated reachable numbers                                                                                                       |
| People        | Active editors, viewer and Home-only member; deactivated former admin; invited member; pending/sent/failed/accepted/revoked and expired invitation reservations; zero active admins reserved for owner bootstrap                                                                                                                   |
| Configuration | Default stages and categories; retired Sales stage/category; active and retired templates for every kind; board/calendar preferences                                                                                                                                                                                               |
| Sharing       | Six live Trip capabilities: selected viewer/hidden tabs, all-tab editor, all-tab viewer, expired, revoked and completed-trip read-only; Public tasks and approval-only Finance submissions; four Doc and three Contacts snapshot capabilities                                                                                      |
| History       | Constructed creation, status, conversion, task, cash, correction, document, sharing and deactivation events with actors and before/after metadata                                                                                                                                                                                  |

The legacy static Trip snapshot gate remains disabled. Use the live Trip links for demo sharing. Confirmed future Trips may advance when their H−2 date arrives; warnings and relative dates naturally change over time.

## Local review files

- `.local/demo/manifest.json`: generated IDs, staff names and row counts.
- `.local/demo/links.json`: thirteen actual demo capability URLs, including intentionally unavailable expired/revoked examples. Keep this ignored file local; editor URLs grant write access to the fictional shared content.
- `.local/demo/reset.sql`: the exact destructive reset and seed used on the hosted project, in one transaction. Do not rerun against real business data.
- `scripts/prepare-demo.ts`: regenerates these local artifacts and validates all migrations, triggers and six admin projections in an isolated PostgreSQL instance. It does **not** execute hosted SQL. Run `npx tsx scripts/prepare-demo.ts --date=YYYY-MM-DD` only when preparing a new reset; it rotates IDs and local demo URLs.

Your new admin has no personally assigned historical tasks. In Home, use the admin assignee filter to inspect **Alya Pratama · Demo Operations** or **Bima Santoso · Demo Sales**. New tasks can be assigned to your real account after bootstrap.

## Validation

All fixture SQL passed the complete local migration set and real validation triggers. Admin snapshots passed for Home, Sales, Trips, Finance, Docs and People. The full hosted reset was first executed with rollback, then committed. Counts, state coverage and sharing reads were checked against hosted data. This does not replace the requested subsequent browser audit/demo or prove Auth login for fictional staff.
