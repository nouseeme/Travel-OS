# Live Trip sharing

Trip sharing now opens `/shared-trip/[token]` without login. Every link has independent Hidden, Viewer or Editor permissions for Overview, Tasks, Notes, Itinerary, Contacts and Finance. Reads return current Trip data; member and public edits share optimistic versions. Expiry is 1–30 days. Updating permissions applies immediately, regenerate revokes the previous link, and revoke blocks subsequent reads/writes. Tokens are generated cryptographically and stored only as hashes; copy a newly created link while it is displayed.

Opened tabs expose their entire content. Notes default to Hidden because existing Trip notes may be internal. Contacts expose name, telephone/email and note; former role/organization fields remain stored and are preserved during public edits. Overview shares trip name/type, dates and guest count; internal member identity, client references, commercial quote and lead links are excluded. Archived Trips remain readable through valid links but cannot be edited or receive new submissions.

Tasks use a real Public assignment, restricted to Trip tasks. Internally the assignee membership reference is nullable for this type, while the application value is `public`. Members can move a task between Public and eligible members. Shared links only receive non-cancelled Public tasks in their own Trip. Editor access allows task creation, edits, status changes and cancellation.

Finance Viewer shows the submissions from that link. Finance Editor can submit a transaction, with exact decimal IDR, date, direction, active category, title and note. No internal ledger, budget, cash total, other link's submissions or member identities are returned. Pending/rejected submissions never affect cash totals. A member needs Finance edit and Trip view access to review; approval posts one transaction atomically and repeated/stale approval is rejected. Rejection requires a reason. Existing transaction correction/void rules still apply after approval.

Background refresh uses fixed toast notifications while retaining the current page. Refresh on focus and the one-minute timer pause while content or a modal is being edited. Failed saves retain inputs. Failed refresh retains previously loaded data, except denied/revoked access removes the public page or protected workspace data. A stale edit must be reconciled before resubmitting.

## Changed files

| File                                                                        | Change                                                                                                                                             |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/detail.tsx`                                                 | Reuses the member detail layout with per-tab public permissions; enables Share; compact Contacts table; public assignment labels and review panel. |
| `src/components/sharing.tsx`                                                | Live link creation, tab permissions, expiry, permission update, regeneration, revocation and one-time copy/open controls.                          |
| `src/components/shared-trip.tsx`                                            | Public Trip shell, forms, current-data loading, unsaved-input guards and submission status.                                                        |
| `src/components/submission-review.tsx`                                      | Member review, approve and reject UI.                                                                                                              |
| `src/components/forms.tsx`, `board.tsx`                                     | Public assignment choice and labels.                                                                                                               |
| `src/components/toast.tsx`, `dashboard.tsx`, `p1.tsx`                       | Fixed refresh/success notifications and preservation of loaded content during refresh.                                                             |
| `src/app/polish.css`                                                        | Toast, compact contact table and shared Trip layout.                                                                                               |
| `src/lib/trip-sharing.ts`, `model.ts`                                       | Per-tab permissions and public submission types.                                                                                                   |
| `src/app/api/shares/route.ts`                                               | Uses live Trip link management while retaining Docs snapshot behavior.                                                                             |
| `src/app/api/shared-trip/route.ts`, `src/app/shared-trip/[token]/page.tsx`  | Public read/edit API and page.                                                                                                                     |
| `src/app/api/workspace/route.ts`, `src/proxy.ts`                            | Member approval commands, no-store public routes and no-referrer headers.                                                                          |
| `supabase/migrations/20261014160000_live_trip_sharing.sql`                  | Private links/submissions, Public tasks, capability-scoped reads/writes and atomic member approval.                                                |
| `supabase/migrations/20261014160100_trip_access_validation.sql`             | Direct-RPC content/ID validation as well as application API validation.                                                                            |
| `scripts/test-database.ts`, `scripts/verify-hosted.ts`, `tests/ui.test.tsx` | Anonymous capability, approval, permission and shared-layout regression checks.                                                                    |

## Validation and release boundary

48 embedded PostgreSQL scenarios and the populated historical migration check pass. 32 unit/component tests pass. Production build and TypeScript pass. Both migrations are applied to the Travel OS Supabase project. Hosted tests use role `anon` to verify projection, hidden-tab denial, Public tasks, pending cash, exact approval and revoke, with all fixtures rolled back. Direct table access and anonymous link management are denied. Browser inspection confirms the enabled Share settings, Public task label and Contacts table in the member view. A populated public browser workflow and deployed cache/log/load checks are not claimed.

The old `/share/[token]` Trip snapshot path retains its legacy disabled gate. Docs snapshots retain their existing workflow. Live Trip sharing uses separate capability RPCs and is enabled without that flag. No actual business Trip link was created by this implementation. Hosting deployment is outside this change; links use the configured `APP_URL`.
