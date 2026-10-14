# Release status

P0 and P1 application code are implemented with a real Supabase backend. Travel OS is connected locally; it is not deployed to Vercel or marked production-ready.

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

P2 remains unimplemented. Email/SMTP and email recovery are deferred by the owner. Sharing has implementation and preview but stays disabled in app and database until Gate C. The database's global request budget also needs deployed abuse/availability review. Hosted leaked-password protection is disabled; no paid-plan upgrade was made. Private tables intentionally deny direct reads through RLS with no policies.

No Git repository was initialized, commit created, push performed or hosting deployment made. Only the newly authorized Travel OS Supabase project was modified.
