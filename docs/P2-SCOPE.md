# P2 first batch

Approved by the owner on 14 October 2026: configurable Trips pipeline, budget vs actual, and clearer audit history. Other roadmap items are separate later batches. Attachments remain outside this scope.

## Acceptance criteria

- Admin can add, rename, reorder and retire Trip stages. Stable IDs preserve records. Open/completed/cancelled semantics remain fixed. There is always one active default open stage. Retirement requires an active replacement of the same semantic kind and moves active Trips atomically with version increments. Historical archived stages remain readable. Conversion uses the configured default and retains its original atomicity/idempotency behavior.
- Finance editors can save nonnegative, whole-IDR budgets per Trip and finance category. These plans are separate from transactions and quoted prices. Finance viewers can compare planned receipts/payments with All time posted cash, excluding void entries. No budget data enters a Trips-only response. Budget writes require current versions and are audited atomically. Inactive categories and archived Trips are read-only.
- Admin audit history supports local-date, actor, exact action and entity/action search filters. Before/after fields display as a readable table; records without historic field-level data explicitly say so. Stage, detail, pipeline and budget changes get allowlisted diffs. No document bodies, passwords, invitation/share tokens or service keys are added to audit metadata.

## Boundaries

Budget variance is favorable receipts = actual − planned, favorable payments = planned − actual. Planned net cash = planned receipts − planned payments; actual net cash remains posted Money In − Money Out. Neither is accrual profit. Explicit zero and unset budget are distinct. Budgets are lifetime Trip plans; changing transaction date filters does not redefine them.

No SSO, role builder, recurrence/dependencies/automation, custom fields, forecasting, resource scheduling or accounting integration is included in this approved batch. Sharing remains disabled until its existing deployed security gate passes.
