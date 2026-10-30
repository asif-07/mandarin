-- Global peers may initiate in either direction. There can be only one open
-- request per pair, including concurrent A->B / B->A attempts.
create unique index one_open_connection_per_pair
  on public.connections (least(sender_id,recipient_id),greatest(sender_id,recipient_id))
  where status in ('pending','accepted');
