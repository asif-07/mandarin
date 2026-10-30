-- Isolated Ambro Connects only. Fixtures and visibility toggles all roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
('c0000000-0000-4000-8000-000000000001','network-admin@example.invalid','{"full_name":"Network QA admin","member_type":"global"}','{"role":"admin"}'),
('c0000000-0000-4000-8000-000000000002','network-china@example.invalid','{"full_name":"Network QA China","member_type":"china"}','{}'),
('c0000000-0000-4000-8000-000000000003','network-sender@example.invalid','{"full_name":"Network QA sender","member_type":"global"}','{}'),
('c0000000-0000-4000-8000-000000000004','network-published@example.invalid','{"full_name":"Network QA published","member_type":"global"}','{}'),
('c0000000-0000-4000-8000-000000000005','network-private@example.invalid','{"full_name":"Network QA private","member_type":"global"}','{}'),
('c0000000-0000-4000-8000-000000000006','network-pending@example.invalid','{"full_name":"Network QA pending","member_type":"global"}','{}'),
('c0000000-0000-4000-8000-000000000007','network-unpaid@example.invalid','{"full_name":"Network QA unpaid","member_type":"global"}','{}'),
('c0000000-0000-4000-8000-000000000008','network-china-other@example.invalid','{"full_name":"Network QA other China","member_type":"china"}','{}');
update public.profiles set bio='Temporary professional network QA fixture',city='Guangzhou',company='QA fixture',specialties=array['Sourcing'] where id::text like 'c0000000-0000-4000-8000-%';
update public.profiles set network_visible=true where id in ('c0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000006','c0000000-0000-4000-8000-000000000007');
update public.member_accounts set moderation_status='approved' where user_id::text like 'c0000000-0000-4000-8000-%';
update public.member_accounts set moderation_status='pending' where user_id='c0000000-0000-4000-8000-000000000006';
insert into public.membership_requests(user_id,plan,reference,status)
  select user_id,case member_type when 'china' then 'china_yearly' else 'global_monthly' end,'QA reference','approved'
  from public.member_accounts where user_id::text like 'c0000000-0000-4000-8000-%' and user_id not in ('c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000007');
insert into public.membership_periods(user_id,source_request_id,plan,amount_rmb,starts_at,expires_at,approved_by)
  select user_id,id,plan,case plan when 'china_yearly' then 1000 else 100 end,now()-interval '1 day',now()+interval '1 year','c0000000-0000-4000-8000-000000000001'
  from public.membership_requests where user_id::text like 'c0000000-0000-4000-8000-%';
insert into public.demo_members(id,full_name,bio,member_type) values
('c0000000-0000-4000-8000-000000000011','Fictional China demo QA','Fictional demo content','china'),
('c0000000-0000-4000-8000-000000000012','Fictional Global demo QA','Fictional demo content','global');

-- Ordinary business counts and dates stay valid; contact text is blocked.
do $$declare value text; begin
  foreach value in array array['1,000 orders','10000 clients','Experience 2026-2027','Visits 2026-10-30 and 2027-10-30'] loop
    if not private.safe_public_text(value) then raise exception 'Valid business text rejected: %',value; end if;
  end loop;
  foreach value in array array['+8613812345678','+91 98765 43210','(020)12345678','person@example.com','https://wa.me/8613812345678','api.whatsapp.com/send','chat.whatsapp.com/test','whatsapp:hello'] loop
    if private.safe_public_text(value) then raise exception 'Contact text allowed: %',value; end if;
  end loop;
end $$;
set local role anon;
do $$begin
  if (select count(*) from public.member_directory where id in ('c0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000004','c0000000-0000-4000-8000-000000000008')) <> 3 then raise exception 'Approved active real members missing'; end if;
  if exists(select 1 from public.member_directory where id in ('c0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000005','c0000000-0000-4000-8000-000000000006','c0000000-0000-4000-8000-000000000007')) then raise exception 'Private/pending/unpaid Global profile leaked'; end if;
  if exists(select 1 from public.profiles where id='c0000000-0000-4000-8000-000000000005') then raise exception 'Private Global directly readable'; end if;
  if (select count(*) from public.member_directory where id in ('c0000000-0000-4000-8000-000000000011','c0000000-0000-4000-8000-000000000012') and is_demo and not verified and rating is null and review_count=0 and completed_connections=0) <> 2 then raise exception 'Demo labeling/trust metrics incorrect'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$declare changed integer; begin
  update public.profiles set network_visible=false where id='c0000000-0000-4000-8000-000000000004';
  get diagnostics changed=row_count;
  if changed <> 0 then raise exception 'Changed another member visibility'; end if;
  begin update public.profiles set is_demo=true where id=auth.uid(); raise exception 'Spoofed real profile demo status'; exception when undefined_column then null; end;
  begin update public.demo_members set enabled=false where id='c0000000-0000-4000-8000-000000000011'; raise exception 'Member changed demo visibility'; exception when insufficient_privilege then null; end;
  begin perform public.set_demo_members_visible(false); raise exception 'Non-admin hid demos'; exception when raise_exception then if sqlerrm <> 'Administrator access is required.' then raise; end if; end;
  begin update public.profiles set bio='Contact: +91 98765 43210' where id=auth.uid(); raise exception 'Direct owner update published phone'; exception when raise_exception then if sqlerrm not like 'Keep email addresses%' then raise; end if; end;
  begin perform public.request_connection('c0000000-0000-4000-8000-000000000005','A private Global target must not accept discovery requests',true); raise exception 'Private Global received a request'; exception when raise_exception then if sqlerrm <> 'This member is not currently available for connections.' then raise; end if; end;
  begin perform public.request_connection('c0000000-0000-4000-8000-000000000011','A demo target must never receive real requests',true); raise exception 'Demo target received request'; exception when raise_exception then if sqlerrm <> 'Demo profiles cannot receive connection requests.' then raise; end if; end;
end $$;
select public.request_connection('c0000000-0000-4000-8000-000000000004','Global member to Global member QA request',true);
select public.request_connection('c0000000-0000-4000-8000-000000000002','Global member to China member QA request',true);
reset role;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
do $$begin
  if not exists(select 1 from public.member_directory where id='c0000000-0000-4000-8000-000000000004') then raise exception 'China member cannot browse Global directory'; end if;
  begin perform public.request_connection('c0000000-0000-4000-8000-000000000008','China to China initiation must remain blocked',true); raise exception 'China initiated China request'; exception when raise_exception then if sqlerrm <> 'An active Global membership is required to connect.' then raise; end if; end;
  begin perform public.request_connection('c0000000-0000-4000-8000-000000000004','China to Global initiation must remain blocked',true); raise exception 'China initiated Global request'; exception when raise_exception then if sqlerrm <> 'An active Global membership is required to connect.' then raise; end if; end;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
do $$declare connection uuid; begin
  select id into connection from public.connections where recipient_id=auth.uid();
  begin perform public.change_connection(connection,'accepted',false); raise exception 'Global acceptance skipped consent'; exception when raise_exception then if sqlerrm <> 'Agree to share your account email to accept this connection.' then raise; end if; end;
  perform public.change_connection(connection,'accepted',true);
  if public.connection_contact(connection) is distinct from 'network-sender@example.invalid' then raise exception 'Consented Global contact missing'; end if;
  perform public.change_connection(connection,'completed',false);
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$declare connection uuid; begin
  select id into connection from public.connections where recipient_id='c0000000-0000-4000-8000-000000000004';
  begin perform public.submit_review(connection,5,'Contact person@example.com for details'); raise exception 'Review leaked public email'; exception when raise_exception then if sqlerrm not like 'Keep email addresses%' then raise; end if; end;
  perform public.submit_review(connection,5,'Professional Global connection QA review');
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
update public.profiles set network_visible=true where id=auth.uid();
do $$begin
  if (select moderation_status from public.member_accounts where user_id=auth.uid()) <> 'pending' then raise exception 'Opt-in skipped profile review'; end if;
  if exists(select 1 from public.member_directory where id=auth.uid()) then raise exception 'Unreviewed opt-in publicly visible'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select public.admin_decision('profile','c0000000-0000-4000-8000-000000000005','approved','Reviewed opt-in QA profile');
select public.admin_decision('review',id,'approved','Reviewed Global QA review') from public.reviews where reviewer_id='c0000000-0000-4000-8000-000000000003';
select public.set_demo_members_visible(false);
do $$begin
  if exists(select 1 from public.member_directory where is_demo) then raise exception 'Hide-all left demo rows public'; end if;
  if not exists(select 1 from public.demo_members where not enabled) then raise exception 'Admin cannot inspect hidden demo rows'; end if;
end $$;
select public.set_demo_members_visible(true);
do $$begin
  if exists(select 1 from public.demo_members where not enabled) then raise exception 'Show-all left demos hidden'; end if;
  if (select count(*) from public.admin_audit_log where actor_id=auth.uid() and entity_kind='demo_directory' and decision in ('show_all','hide_all')) <> 2 then raise exception 'Demo visibility audit missing'; end if;
end $$;
reset role;
set local role anon;
do $$begin
  if not exists(select 1 from public.member_directory where id='c0000000-0000-4000-8000-000000000005' and member_type='global' and not is_demo) then raise exception 'Reviewed opted-in Global missing'; end if;
  if not exists(select 1 from public.member_directory where id='c0000000-0000-4000-8000-000000000004' and rating=5 and review_count=1 and completed_connections=1) then raise exception 'Global reviewed statistics incorrect'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"sub":"c0000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
update public.profiles set network_visible=false where id=auth.uid();
do $$begin
  if (select moderation_status from public.member_accounts where user_id=auth.uid()) <> 'approved' then raise exception 'Hiding unchanged approved Global revoked membership'; end if;
  if exists(select 1 from public.member_directory where id=auth.uid()) then raise exception 'Opted-out Global remained visible'; end if;
end $$;
reset role;
update public.member_accounts set moderation_status='rejected' where user_id='c0000000-0000-4000-8000-000000000005';
set local role authenticated;
update public.profiles set bio='Corrected private Global QA profile' where id=auth.uid();
do $$begin
  if (select moderation_status from public.member_accounts where user_id=auth.uid()) <> 'pending' then raise exception 'Rejected private Global could not resubmit'; end if;
end $$;
reset role;
select 'PASS: network opt-in privacy, real/demo separation, Global-only initiation, Global recipient consent/review, admin demo visibility, contact guards and resubmission' as result;
rollback;
