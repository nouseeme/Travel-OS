# Release status

P0, P1 and the approved first P2 batch are implemented with a real Supabase backend. Travel OS is connected locally; it is not deployed to Vercel or marked production-ready.

## Changes by file group

- src/components/p1.tsx: inclusive Calendar with saved view, Sales distribution/Prospect analytics, exact month/quarter cash comparison, stage/category/template editors, copied Append/Replace templates and admin audit viewer.
- src/components/dashboard.tsx, board.tsx, forms.tsx, detail.tsx: navigation, stable stage IDs with editable labels, Home date/context filters, active-category selection, template application, sharing preview and one-time manual invitation link display.
- src/components/sharing.tsx: selected-content preview, expiry, publish/update/revoke/regenerate controls. Public publishing stays disabled until Gate C.
- src/app/api/insights, api/shares and share/[token]: permission-checked queries and commands, static read-only share output with no cache/client scripts, strict selection validation and cryptographic tokens.
- src/lib/public-markdown.ts: HTML/URL sanitization and image removal for public documents; model/filter contracts expanded for P1.
- supabase/migrations: versioned configuration, user preferences, aggregates, private sharing snapshots, persistent request budget, manual invitation channel and hosted grant/index hardening. Existing core SQL remains preserved as migration history.
- supabase/functions/send-invitation: active-admin scoped manual link generation; optional future email delivery. Deployed to the new project. No token storage/logging or email sends in manual mode.
- src/components/auth.tsx and Auth/setup APIs: email recovery explicitly deferred; manual invitation password activation retains generation/password validation.
- scripts/verify-hosted.ts and tests: live negative access tests, P1 SQL regressions and public Markdown/exact comparison tests.
- README.md and docs: setup, verification and release boundaries updated. The original PRD is unchanged.

## Verification and remaining gates

Production build and TypeScript pass. Unit/component and embedded PostgreSQL results are in ACCEPTANCE.md. Live signup/anonymous access/internal RPC/sharing gate/Edge authentication checks pass. No synthetic business records were loaded into the project.

Signed-in Calendar, Sales analytics, Finance comparison, configuration and live audit rendering were checked. Manual invitation generation and recipient password activation for the requested work address passed; Home-only navigation matches default no-module privileges. Supabase confirms accepted invitation/active membership. Calendar persistence and a 390 px viewport without horizontal overflow were verified. A responsive rule hiding view switches was fixed. Preview connectivity/navigation recovered after restoring development and reopening the tab; root cause of the earlier interruption was not established.

The owner explicitly removed the three-user cap. A migration removes only the capacity guard; duplicate-email, permission, generation and last-admin safeguards remain. Regression scenarios verify invitations beyond three users. Broader multi-account permission regression, independent-connection races, hosting/performance and backup/restore remain release verification.

The approved first P2 batch covers configurable Trips stages, Trip category budgets vs posted cash actuals, and readable audit diffs with local-date/actor/action filters. Other P2 roadmap items remain separate later batches (see P2-SCOPE.md). Email/SMTP and email recovery are deferred by the owner. Sharing has implementation and preview but stays disabled in app and database until Gate C. The database's global request budget also needs deployed abuse/availability review. Hosted leaked-password protection is disabled; no paid-plan upgrade was made. Private tables intentionally deny direct reads through RLS with no policies.

Git is initialized on main without commits. No push or hosting deployment was performed. Only the newly authorized Travel OS Supabase project was modified.

## 14 October 2026 — editor, timezone and first P2 batch

- src/components/rich-editor.tsx and rich-editor-client.tsx: client-loaded Tiptap WYSIWYG toolbar; heading hierarchy, lists, bold/italic/strike, inline code/code blocks, links, quotes, undo/redo. Notes, Markdown templates and itinerary descriptions use it. Existing explicit save/read-only/unsaved-change behavior remains.
- src/lib/editor-extensions.ts and editor-content.ts: Markdown round-trip extensions, safe link schemes and protection for unsupported historical content. Tables/checklists remain compatible. package.json/package-lock.json pin Tiptap 3.32.0 packages.
- src/lib/time.ts, format.ts, domain.ts, filters.ts and src/app/api/workspace/route.ts: validated browser timezone requests, local timestamp display and date-only preservation; audit/P2 filters and validated whole-IDR budget commands.
- src/components/dashboard.tsx, forms.tsx, detail.tsx, p1.tsx and sharing.tsx: local day/greeting/expiry/audit display; midnight/timezone refresh; configured Trip stage labels/defaults in boards/forms/details/Calendar; global/Trip Finance budgets and configuration/audit UI wiring.
- src/components/p2.tsx: pipeline management, budget category plans and exact BigInt variance, read-only Finance view, request cancellation, sibling draft preservation on refresh and readable before/after audit tables.
- src/app/polish.css: editor and P2 layout styles retain the original green/sage palette and Plus Jakarta Sans.
- supabase/migrations/20261014120000_local_ui_timezone.sql and 20261014130000_p2_pipeline_budgets_history.sql, plus 20261014140000_p2_membership_recheck.sql: applied to the Travel OS Supabase project. UTC timestamp output, request-local date validation/analytics; workspace-scoped pipeline stages, atomic retirement/default conversion, Finance-protected versioned budgets and allowlisted append-only change events and post-lock membership rechecks. No business data was rewritten or synthetic Trip/budget/transaction created in the hosted project.
- tests/editor-time.test.ts, ui.test.tsx, security.test.ts and scripts/test-database.ts/verify-hosted.ts: Markdown/links/content protection, template replacement, timezone boundaries/DST, exact budget/permission behavior, stage retirement/conversion, local audit filters and hosted anonymous denials.
- docs/PRE-P2-REQUIREMENTS.md and P2-SCOPE.md: owner decisions and approved acceptance criteria. The original PRD remains unchanged.

Production build/TypeScript pass. All 22 unit/component tests and 35 embedded PostgreSQL scenarios pass. Hosted checks confirm anonymous tables/RPCs remain denied, signup/sharing remain disabled, and only the four default Trip stages were seeded (no test budgets). Signed-in desktop/mobile configuration, Tiptap template loading/editing, Finance budget empty state and local-time audit filters/rendering were inspected without saving test content. Full populated-data multi-account browser regression, hosting/performance and backup/restore remain release checks.

# Workspace refinements update — 14 October 2026

This update supersedes the earlier four-column/customizable Trip pipeline and integer-only Finance behavior. The requested refinements are implemented, with the approved hosted migration applied and its Cron job verified. Local code remains uncommitted and the app is not deployed to Vercel. See [WORKSPACE-REFINEMENTS.md](WORKSPACE-REFINEMENTS.md) for each changed file, final behavior, 27 unit/component tests, 40 database scenarios, populated migration/hosted checks and browser verification boundaries.

## Live Trip sharing update

Live Trip sharing is now enabled through a separate capability-based path, with per-link Hidden/Viewer/Editor tabs, Public tasks, and pending Finance submissions approved by Finance editors with Trip access. Contacts use a compact name/telephone-email/note table. Refresh uses fixed toast notifications. Both migrations are applied. Earlier statements about disabled sharing refer to the legacy static Trip snapshot path. See [Trip sharing](TRIP-SHARING.md) for changed files, validation and remaining hosting checks.
