-- Run against the isolated Ambro Connects project. All fixtures are rolled back.
begin;
insert into private.admin_bootstrap_emails(email) values('bootstrap-test@example.invalid');
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
('a0000000-0000-4000-8000-000000000001','admin-test@example.invalid','{"full_name":"Security admin","member_type":"global"}','{"role":"admin"}'),
('a0000000-0000-4000-8000-000000000002','china-test@example.invalid','{"full_name":"Security China","member_type":"china"}','{}'),
('a0000000-0000-4000-8000-000000000003','global-test@example.invalid','{"full_name":"Security Global","member_type":"global"}','{}'),
('a0000000-0000-4000-8000-000000000004','outsider-test@example.invalid','{"full_name":"Security outsider","member_type":"global","role":"admin"}','{}'),
('a0000000-0000-4000-8000-000000000005','bootstrap-test@example.invalid','{"full_name":"Bootstrap test","member_type":"global"}','{}');
do $$ begin
  if exists(select 1 from auth.users where id='a0000000-0000-4000-8000-000000000005' and raw_app_meta_data->>'role'='admin') then raise exception 'Unverified bootstrap email became admin'; end if;
end $$;
update auth.users set email_confirmed_at=now() where id='a0000000-0000-4000-8000-000000000005';
do $$ begin
  if not exists(select 1 from auth.users where id='a0000000-0000-4000-8000-000000000005' and raw_app_meta_data->>'role'='admin') then raise exception 'Verified bootstrap email did not become admin'; end if;
end $$;
update public.profiles set bio='Business introduction',city='Guangzhou',company='Security test',specialties=array['Sourcing'] where id='a0000000-0000-4000-8000-000000000002';
set local role anon;
do $$ begin
  if exists(select 1 from public.member_directory) then raise exception 'Unapproved profile publicly visible'; end if;
  begin perform * from public.member_accounts; raise exception 'Anonymous private accounts readable'; exception when insufficient_privilege then null; end;
  begin perform * from private.admin_bootstrap_emails; raise exception 'Bootstrap allowlist leaked'; exception when insufficient_privilege then null; end;
  begin perform public.request_membership('global_monthly','fake',''); raise exception 'Anonymous mutation allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin update public.member_accounts set moderation_status='approved' where user_id=auth.uid(); raise exception 'Self approval allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.membership_periods(user_id,source_request_id,plan,amount_rmb,starts_at,expires_at,approved_by) values(auth.uid(),gen_random_uuid(),'global_monthly',100,now(),now()+interval '1 month',auth.uid()); raise exception 'Self activation allowed'; exception when insufficient_privilege then null; end;
  begin perform public.admin_decision('profile',auth.uid(),'approved',''); raise exception 'Non-admin moderation allowed'; exception when raise_exception then if sqlerrm <> 'Administrator access is required.' then raise; end if; end;
  update public.profiles set bio='Own profile update works' where id=auth.uid();
  if (select bio from public.profiles where id=auth.uid()) <> 'Own profile update works' then raise exception 'Own profile update failed'; end if;
  perform public.request_membership('global_monthly','test-payment-global','');
  if exists(select 1 from public.membership_periods where user_id=auth.uid()) then raise exception 'Pending request activated member'; end if;
  begin perform public.request_connection('a0000000-0000-4000-8000-000000000002','I need help with sourcing',true); raise exception 'Unpaid connection allowed'; exception when raise_exception then if sqlerrm <> 'An active Global membership is required to connect.' then raise; end if; end;
  insert into storage.objects(bucket_id,name) values('member-media',auth.uid()::text || '/avatar/security-test.png');
  begin insert into storage.objects(bucket_id,name) values('member-media','a0000000-0000-4000-8000-000000000002/avatar/security-test.png'); raise exception 'Upload into another account allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select public.request_membership('china_yearly','test-payment-china','');
reset role;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.admin_decision('profile','a0000000-0000-4000-8000-000000000002','approved','Test profile checked');
select public.admin_decision('membership',id,'approved','Test payment checked') from public.membership_requests where status='pending';
do $$ begin
  if not exists(select 1 from public.membership_periods where plan='china_yearly' and amount_rmb=1000 and expires_at=starts_at+interval '1 year') then raise exception 'China pricing/dates incorrect'; end if;
  if not exists(select 1 from public.membership_periods where plan='global_monthly' and amount_rmb=100 and expires_at=starts_at+interval '1 month') then raise exception 'Global pricing/dates incorrect'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin perform public.request_connection('a0000000-0000-4000-8000-000000000002','I need help with sourcing',false); raise exception 'Sender consent bypassed'; exception when raise_exception then if sqlerrm <> 'Agree to share your account email when this member accepts your request.' then raise; end if; end;
  perform public.request_connection('a0000000-0000-4000-8000-000000000002','I need help with sourcing',true);
  if (select count(*) from public.member_directory) <> 1 then raise exception 'Active China profile not discoverable'; end if;
  if (select public.connection_contact(id) from public.connections where sender_id=auth.uid()) is not null then raise exception 'Contact leaked before acceptance'; end if;
  begin perform public.change_connection((select id from public.connections where sender_id=auth.uid()),'accepted',true); raise exception 'Sender accepted own request'; exception when raise_exception then if sqlerrm <> 'Only the recipient can update this connection.' then raise; end if; end;
  begin perform public.submit_review((select id from public.connections where sender_id=auth.uid()),5,'Premature review should fail'); raise exception 'Uncompleted review allowed'; exception when raise_exception then if sqlerrm <> 'You can review only your own completed connections.' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin perform public.change_connection((select id from public.connections where recipient_id=auth.uid()),'accepted',false); raise exception 'Recipient consent bypassed'; exception when raise_exception then if sqlerrm <> 'Agree to share your account email to accept this connection.' then raise; end if; end;
  perform public.change_connection((select id from public.connections where recipient_id=auth.uid()),'accepted',true);
  if (select public.connection_contact(id) from public.connections where recipient_id=auth.uid()) <> 'global-test@example.invalid' then raise exception 'Consented contact unavailable'; end if;
  perform public.change_connection((select id from public.connections where recipient_id=auth.uid()),'completed',false);
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  if private.is_admin() then raise exception 'User metadata elevated privileges'; end if;
  if exists(select 1 from public.connections) then raise exception 'Outsider connections leaked'; end if;
  if exists(select 1 from public.membership_requests) then raise exception 'Private payment references leaked'; end if;
  if exists(select 1 from public.connection_contacts(array(select id from public.connections))) then raise exception 'Outsider contact leaked'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select public.submit_review(id,5,'The sourcing project went very well') from public.connections where sender_id=auth.uid();
do $$ begin
  begin perform public.submit_review((select id from public.connections where sender_id=auth.uid()),1,'A duplicate review must fail'); raise exception 'Duplicate review allowed'; exception when unique_violation then null; end;
end $$;
select public.request_membership('trip_year','test-trip-booking','');
reset role;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.admin_decision('review',id,'approved','Reviewed test review') from public.reviews where status='pending';
select public.admin_decision('membership',id,'approved','Verified test trip') from public.membership_requests where status='pending';
do $$ begin
  if not exists(select 1 from public.membership_periods where plan='trip_year' and amount_rmb=0 and expires_at=starts_at+interval '1 year') then raise exception 'Trip benefit pricing/dates incorrect'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin perform public.request_membership('trip_year','second-trip',''); raise exception 'Repeated trip benefit allowed'; exception when raise_exception then if sqlerrm <> 'Your complimentary trip membership has already been used.' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$ begin
  if (select rating from public.member_directory) <> 5 or (select review_count from public.member_directory) <> 1 or (select completed_connections from public.member_directory) <> 1 then raise exception 'Public trust statistics incorrect'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
update public.profiles set company='Edited after approval' where id=auth.uid();
do $$ begin
  if (select moderation_status from public.member_accounts where user_id=auth.uid()) <> 'pending' then raise exception 'Profile edit did not reset approval'; end if;
  if exists(select 1 from public.member_directory) then raise exception 'Unreviewed edit remained public'; end if;
end $$;
reset role;
update public.member_accounts set moderation_status='rejected',moderation_reason='Please correct the company' where user_id='a0000000-0000-4000-8000-000000000002';
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
update public.profiles set company='Corrected company' where id=auth.uid();
do $$ begin
  if (select moderation_status from public.member_accounts where user_id=auth.uid()) <> 'pending' then raise exception 'Rejected profile could not resubmit'; end if;
end $$;
reset role;
update public.member_accounts set moderation_status='suspended' where user_id='a0000000-0000-4000-8000-000000000002';
set local role authenticated;
update public.profiles set company='Trying to clear suspension' where id=auth.uid();
do $$ begin
  if (select moderation_status from public.member_accounts where user_id=auth.uid()) <> 'suspended' then raise exception 'Profile update cleared suspension'; end if;
end $$;
reset role;
select 'PASS: auth/bootstrap, RLS, immutable billing, active discovery, connection consent, reviews, media ownership, resubmission and suspension' as result;
rollback;
