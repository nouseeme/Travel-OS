# Home, Contacts and Team & Settings

- Home sidebar count uses `homeTaskCount`: all unfinished, uncancelled tasks assigned to the signed-in user, independently of active module, filters, board limits and team-task selection.
- Internal has Docs and Contacts tabs. Contacts combines registered contacts from accessible CRM/Trip records, including archives, and saved internal contacts. The source column links to each originating record. Removed contacts are not reconstructed from historical audit data.
- Saved CRM, Trip and Internal contacts render as compact tables. Edit contacts explicitly opens inputs; successful save returns to the table, while failed saves preserve changes. Internal contact edits use optimistic versions.
- Internal Contacts has no Share button. Docs and Trip sharing remain available through their existing controls.
- Team & Settings is visible and accessible only to admins, including direct URLs and database snapshot calls. Stage/category configuration writes also require admin status. Existing template operations retain module permission checks; task work, contact edits and Trip view preferences remain available to module editors.
- Docs search has a dedicated responsive layout, full-width input within its container and visible focus indication.

Implementation: `dashboard.tsx`, `detail.tsx`, `internal-contacts.tsx`, `polish.css`, and migrations `internal_contacts_home_count` / `admin_only_settings`. Regression coverage is in `tests/ui.test.tsx` and `scripts/test-database.ts`.

Validated with 35 application tests, 51 embedded PostgreSQL scenarios, type checking and a production build. The database migrations were applied to the connected Travel OS project. Browser verification of authenticated screens requires an existing signed-in session; the inspection browser reached Login.
