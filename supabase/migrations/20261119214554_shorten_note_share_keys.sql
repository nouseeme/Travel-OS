alter table private.note_share_links
  alter column share_key set default left(
    translate(encode(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 'base64'), '+/', '-_'),
    5
  );
