revoke execute on function private.document_integrity() from public,anon,authenticated;
alter default privileges in schema private revoke execute on functions from public;
