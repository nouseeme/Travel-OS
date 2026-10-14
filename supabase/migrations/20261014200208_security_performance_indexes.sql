-- Cover referencing foreign keys without changing data or access policies.
create index contact_share_links_workspace on private.contact_share_links(workspace_id);
create index doc_share_links_doc_workspace on private.doc_share_links(doc_id, workspace_id);
create index trip_submissions_trip_workspace on private.trip_submissions(trip_id, workspace_id);
create index internal_docs_workspace_creator on public.internal_docs(workspace_id, creator);
create index transaction_corrections_requested_by on public.transaction_corrections(requested_by);
create index transaction_corrections_reviewed_by on public.transaction_corrections(reviewed_by);
create index transaction_corrections_workspace on public.transaction_corrections(workspace_id);
create index trip_budgets_category on public.trip_budgets(category_id);
create index trip_budgets_trip_workspace on public.trip_budgets(trip_id, workspace_id);
