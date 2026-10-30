-- Global peer request uniqueness. Fixtures and all transitions are rolled back.
begin;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
('d0000000-0000-4000-8000-000000000001','pair-a@example.invalid','{"full_name":"Pair QA Alpha","member_type":"global"}','{}'),
('d0000000-0000-4000-8000-000000000002','pair-b@example.invalid','{"full_name":"Pair QA Beta","member_type":"global"}','{}');
update public.profiles set network_visible=true,bio='Temporary Global pair regression fixture',city='Dubai',specialties=array['Business services'] where id::text like 'd0000000-0000-4000-8000-%';
update public.member_accounts set moderation_status='approved' where user_id::text like 'd0000000-0000-4000-8000-%';
insert into public.membership_requests(user_id,plan,reference,status) select user_id,'global_monthly','Pair QA reference','approved' from public.member_accounts where user_id::text like 'd0000000-0000-4000-8000-%';
insert into public.membership_periods(user_id,source_request_id,plan,amount_rmb,starts_at,expires_at,approved_by)
  select user_id,id,'global_monthly',100,now()-interval '1 day',now()+interval '1 month','d0000000-0000-4000-8000-000000000001' from public.membership_requests where user_id::text like 'd0000000-0000-4000-8000-%';
select set_config('request.jwt.claims','{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.request_connection('d0000000-0000-4000-8000-000000000002','Alpha initiates a Global peer request',true);
reset role;
select set_config('request.jwt.claims','{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$begin
  begin
    perform public.request_connection('d0000000-0000-4000-8000-000000000001','Beta tries a reverse pending peer request',true);
    raise exception 'Reverse pending request was allowed';
  exception when unique_violation then null;
  end;
  if (select count(*) from public.connections where sender_id in ('d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002') and status in ('pending','accepted')) <> 1 then raise exception 'Pair has incorrect open request count'; end if;
end $$;
select public.change_connection(id,'declined',false) from public.connections where sender_id='d0000000-0000-4000-8000-000000000001';
select public.request_connection('d0000000-0000-4000-8000-000000000001','Beta initiates after prior request declined',true);
reset role;
select set_config('request.jwt.claims','{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.change_connection(id,'accepted',true) from public.connections where sender_id='d0000000-0000-4000-8000-000000000002' and status='pending';
do $$begin
  begin
    perform public.request_connection('d0000000-0000-4000-8000-000000000002','Alpha tries a reverse accepted peer request',true);
    raise exception 'Reverse accepted request was allowed';
  exception when unique_violation then null;
  end;
end $$;
select public.change_connection(id,'completed',false) from public.connections where sender_id='d0000000-0000-4000-8000-000000000002' and status='accepted';
select public.request_connection('d0000000-0000-4000-8000-000000000002','Alpha initiates after prior request completed',true);
do $$begin
  if (select count(*) from public.connections where sender_id in ('d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002') and status='pending') <> 1 then raise exception 'Request after completion failed'; end if;
end $$;
reset role;
select 'PASS: reverse pending/accepted requests fail 23505; new requests after decline/completion succeed' as result;
rollback;
