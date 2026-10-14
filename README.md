# travelOS · Egimu Travel

The hosted database was reset and populated with a fictional six-month demo history on 14 October 2026. Previous real Auth accounts were removed; no active admin exists until owner bootstrap. See [demo coverage and first-admin instructions](docs/DEMO-DATA.md). Ordinary `supabase/seed.sql` remains minimal; demo resets are prepared separately and never run automatically.

Internal, invite-only travel operations application built from [the PRD](Travel-OS-MVP-PRD.md). The app uses real Supabase Auth and PostgreSQL. There is no demo login, local-storage database, public signup, or anonymous access to workspace records.

The latest [workspace refinements](docs/WORKSPACE-REFINEMENTS.md) are implemented in the local preview, and their approved Supabase migration is applied. Code remains local and uncommitted; no application deployment was made.

## Implemented application

- Home: shared Assigned/Doing/Done tasks, workspace-date deadline warnings, internal tasks, admin assignee filters, server-side card limits and Load More.
- Sales: three-stage Kanban with drag and dropdown alternatives, structured fields, eligible PIC, notes, contacts, itinerary draft, Lost/manual archive, restore, and atomic conversion to a Planned Trip. Conversion copies documents, preserves unfinished task IDs, archives the source, and creates no cash entry.
- Trips: Planned → Confirmed → In Progress, with Confirmed automatically advancing at H−2 in workspace time. Completed/Cancelled trips appear in the table archive. Dates/guest/quotation/assigned-people validation, notes, contacts, tasks, stacked-day itinerary editing, drag reorder/move and keyboard-friendly Move Up/Down/To Day remain available. Trip Finance requires Trips and Finance view privileges.
- Finance: one Record transaction form, titles and optional notes, formatted IDR input with up to two decimals, exact decimal arithmetic, category/context filters, compact signed amounts, pagination, cash totals and per-trip results. Editors propose corrections; admins approve/reject them or mark a transaction void. Pending corrections leave posted totals unchanged. Creation is idempotent. Finance viewers can export all matching rows with formula-safe CSV cells.
- Internal Docs: searchable, paginated Judul/Date/Creator/Category table; versioned Markdown/WYSIWYG documents; templates; view/edit module privileges; and expiring, revocable view-only snapshot links.
- People: invite-only membership without an application user cap, multiple admins, manual activation links, failure tracking, regenerate/revoke, editable roles/privileges, deactivation, and tasks needing reassignment. The last active admin cannot be demoted or deactivated. Module access follows explicit privileges, including for admins.
- Foundation: read RLS; no direct authenticated DML; narrow user-scoped RPC writes with field allowlists, database validation, optimistic version checks, workspace-consistent foreign keys, audit events and transaction rollback. Markdown skips raw HTML, executable URLs and remote image embeds. Requests check Origin, enforce body limits and use private/no-store responses.
- P1: inclusive Trip Calendar with per-user saved view, Sales distribution/Prospect analytics, exact month/quarter cash comparison, module-scoped configuration and audit, copied Append/Replace templates, and Home date/context filters. Only admins can inspect other people's tasks in Home.
- Sharing: selected-content Trip previews retain their existing security gate. Internal Docs editors can deliberately publish view-only document snapshots. Both use private snapshots, expiring hashed tokens, revoke/publish-update commands, a persistent request budget, and static sanitized public documents.

## Local setup

Requires Node.js 24.15+ (or 22.22.2+) and a Supabase project. Install the pinned dependencies with `npm ci`, then copy `.env.example` to `.env.local` and set:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=YOUR_SERVER_ONLY_SECRET_OR_SERVICE_ROLE_KEY
APP_URL=http://127.0.0.1:3000
WORKSPACE_ID=10000000-0000-4000-8000-000000000001
INVITATION_DELIVERY=manual
EMAIL_DELIVERY_ENABLED=false
SHARING_ENABLED=false
```

Ordinary reads and business mutations use the authenticated user's cookie client and database authorization. Manual invitation delivery uses the deployed `supabase/functions/send-invitation` function, which verifies the caller and active admin membership before using Supabase's built-in server credentials to generate an activation link. The app shows it once for the admin to copy and send personally; it sends no email. Generate ulang rotates the generation and invalidates prior activation links. Raw links/tokens are not stored in application tables or audit. Provider token expiry applies independently of the application's seven-day reservation expiry. Set `workspaces.app_url` to the same origin as `APP_URL`. Never put a secret/service-role key in a `NEXT_PUBLIC_` variable or commit `.env.local`.

Apply the SQL files in `supabase/migrations/` in filename order to the new project, then run `supabase/seed.sql`. The seed creates only the workspace and proposed Finance categories; it does not insert fictitious business records or Auth users. The default workspace timezone is Asia/Jakarta, as specified by assumption A06, independently of the device timezone.

### Supabase Auth configuration

1. Disable **Allow new users to sign up** and anonymous sign-ins. Email/password sign-in stays enabled. Keep email confirmation enabled.
2. Set the Site URL to `APP_URL`. Allow the exact application callback domain/path, including the query parameters used by invitations. For local development, allow `http://127.0.0.1:3000/auth/callback**`; add only the intended deployment callback URL when deploying.
3. Manual invitations need no SMTP or custom email templates. Use People → Invite, copy the activation link, and send it yourself. If lost/expired, use Generate ulang. The recipient chooses their own password before activation.
4. Email delivery/recovery are deferred by the owner. To enable later, configure custom SMTP, set `INVITATION_DELIVERY=email` and `EMAIL_DELIVERY_ENABLED=true`, and verify delivery. Set the **Invite user** link to `<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite">Activate Travel OS</a>` and the **Reset password** link to `<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Continue to Travel OS</a>`. RedirectTo already includes `flow`, so `&` is intentional. Until enabled, recovery directs the user to the administrator/project owner.
5. Create the first confirmed Auth user manually through Supabase, setting the password yourself. Then run `npm run bootstrap -- --email YOUR_EMAIL --name YOUR_NAME`. This activates one initial admin; it refuses to add an admin if one is already active. There is no public bootstrap endpoint. Alternatively, the project owner can insert the same membership through a controlled SQL session.

Invitation delivery reserves a slot before calling the provider. Failure leaves a failed/pending reservation for retry or revoke. Resend rotates the application generation. A revoked/superseded/expired invitation cannot activate membership even if its old Auth link still creates a session. Create-password validates the invitation before changing the password, and checks again during activation. The activation RPC also requires a nonempty provider password hash, so an initial invite session cannot skip password creation by calling the Data API directly.

Run `npm run dev` and open [Travel OS](http://127.0.0.1:3000). On Windows, restricted shells may prevent the Next.js compiler from resolving the workspace path; run the same build/dev command in a normal terminal if that occurs.

## Database design decisions

The PRD's separate leads/trips entities share a `journeys` table with an immutable kind. Named notes, contacts and ordered itinerary days/items are validated JSONB documents owned by that parent, rather than separate child tables. An entire document update is atomic and checks the parent version; array order defines contiguous day/item numbering. This makes conflicts conservative: simultaneous edits of different documents under one parent still conflict. Document IDs are unique, and conversion assigns new IDs to copied documents. These are explicit storage deviations from §10.1, while preserving its workflows and access boundaries.

Tasks remain separate shared rows. The ledger remains a separate table with bigint amounts and numeric aggregates serialized as decimal strings. Module privileges are a constrained JSONB value on membership, rather than three rows in a separate module_privileges table. Finance categories are seeded once for this single-workspace application.

Read policies enforce current membership and module privileges. App users have SELECT grants only. Private security-definer implementations support atomic audited commands; public wrappers are security invoker, EXECUTE grants are explicit, search paths are fixed, and actors derive from auth.uid(). Workspaces are locked for mutations and atomic conversion. The owner removed the three-user cap; infrastructure/provider limits still apply, and large-team throughput has not been load-tested.

## Verification

```text
npm run typecheck
npm test
npm run db:test
npm run build
npm run hosted:test
```

`db:test` runs migrations and seed against embedded PostgreSQL with a minimal test-only Auth schema. It exercises real SQL, grants, RLS, private commands, transaction rollback and projections. It is not a hosted Supabase Auth/SMTP test. The test database is ephemeral and never writes fixtures to the working Supabase project.

See [acceptance evidence](docs/ACCEPTANCE.md) and [release status](docs/RELEASE.md). Build success and isolated SQL tests do not establish hosted invitation deliverability, production backup restoration, cross-connection race behavior, or the PRD's deployed performance target.

## Vercel deployment

Import this Next.js project in Vercel, use `npm ci` and `npm run build`, configure the same environment variables with `APP_URL` set to the HTTPS deployment domain, and allow its exact callback URL in Supabase. Keep the secret key server-only. Trip bearer links expose only the tabs explicitly enabled by their creator; public Finance exposes submissions rather than the internal ledger. Authentication-token URL logging must be redacted at the hosting layer as well as the app layer; application request/function/browser-console logging is disabled. Use a separate validation environment before introducing real sensitive data.

## Remaining release scope

Live Trip sharing is enabled with per-link tab permissions, Public tasks and approval-only Finance submissions. See [Trip sharing](docs/TRIP-SHARING.md) for behavior and validation. The legacy static Trip snapshot workflow retains `SHARING_ENABLED=false` and `workspaces.sharing_enabled=false`; these flags do not disable the new live Trip links. Deployed token/log redaction, cache behavior and request-budget availability checks remain hosting verification. Live public access has a persistent global 300 requests/minute budget.

Email delivery/recovery are deferred by the owner; manual invitation links are supported. Full three-account browser UAT, independent-connection races, hosting, performance and backup/restore remain release work. P2 custom roles/SSO, recurrence/dependencies/automation, forecasting/custom fields, resource scheduling/custom Trip pipeline, budgets/accounting integrations, richer history and layout builder are not implemented. Owner assumptions still need confirmation before an internal pilot.

## Latest product changes

The approved P2 first batch adds configurable Trips stages, IDR category budgets vs posted cash actuals, and readable audit history. Markdown editing uses Tiptap WYSIWYG. Timestamps are stored as UTC and displayed in the browser timezone; date-only values retain their calendar date. See [P2 scope](docs/P2-SCOPE.md), [time/editor requirements](docs/PRE-P2-REQUIREMENTS.md) and [release validation](docs/RELEASE.md).
