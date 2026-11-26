# Rolled-back test for sample listings: applies the migration and the seed, checks the rules, then undoes it all.
#   python3 -I scripts/db-tests/sample_listings.py > /tmp/s.sql && supabase db query --linked --file /tmp/s.sql
# Expect: ROLLBACK_TEST_RESULT passed=N failed=[]. Only before 20261127100000_sample_listings is applied.
mig = open('supabase/migrations/20261127100000_sample_listings.sql').read()
seed = open('scripts/sample-listings/seed.sql').read().replace('begin;', '').replace('commit;', '')
test = r'''
create function pg_temp.as_user(u uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $f$;
do $t$
declare s uuid := gen_random_uuid(); adm uuid := gen_random_uuid(); u uuid; rid uuid; rm uuid; n int; ok int := 0; bad text := ''; rooms jsonb;
begin
  foreach u in array array[s, adm] loop
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rb-'||u||'@havenly-e2e.test', '{}');
    insert into profiles (id, username, display_name) values (u, 'rb_'||substr(replace(u::text,'-',''),1,20), 'RB') on conflict (id) do nothing;
  end loop;
  update profiles set is_admin = true where id = adm;
  insert into profile_private (user_id, budget_aed, alert_new_places) values (s, 9000, true);
  select count(*) into n from residences where is_sample and name like 'Sample %' and is_active;
  if n <> 6 then bad := bad||' seeded='||n; else ok := ok+1; end if;
  select count(*) into n from room_types t join residences r on r.id = t.residence_id where r.is_sample;
  if n <> 7 then bad := bad||' rooms='||n; else ok := ok+1; end if;
  select id into rid from residences where name = 'Sample Home, Jumeirah Lake Towers';
  -- Signed out sees them
  perform set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
  select count(*) into n from residences where is_sample; if n <> 6 then bad := bad||' anon='||n; else ok := ok+1; end if;
  reset role;
  -- A student can save, but not enquire or start a group
  perform pg_temp.as_user(s);
  begin insert into saved_residences (user_id, residence_id) values (s, rid); ok := ok+1; exception when others then bad := bad||' save:'||sqlerrm; end;
  begin insert into housing_enquiries (user_id, residence_id, kind, move_in_month, duration_months, contact_phone) values (s, rid, 'question', date_trunc('month', now() + interval '1 month')::date, 12, '+971 50 000 0000'); bad := bad||' enquiry-allowed'; exception when others then ok := ok+1; end;
  begin perform public.create_enquiry_group(rid, '+971 50 000 0000'); bad := bad||' group-allowed'; exception when others then ok := ok+1; end;
  reset role;
  -- The team lowers a sample's price: no alerts, saving still works
  select id into rm from room_types where residence_id = rid;
  perform pg_temp.as_user(adm);
  rooms := jsonb_build_array(jsonb_build_object('id', rm, 'name', 'Whole 3 bedroom home', 'price_aed', 7000, 'billing_period', 'month', 'occupancy', 1, 'is_available', true));
  begin perform save_residence(rid, jsonb_build_object('name','Sample Home, Jumeirah Lake Towers','provider_name','Sample Housing Partner','area','Jumeirah Lake Towers','is_active',true,'listing_type','home','bedrooms',3), rooms, '{"referral_fee_percent":0}'); ok := ok+1; exception when others then bad := bad||' save_residence:'||sqlerrm; end;
  reset role;
  select count(*) into n from notifications where residence_id = rid; if n <> 0 then bad := bad||' alerts='||n; else ok := ok+1; end if;
  select is_sample::int into n from residences where id = rid; if n <> 1 then bad := bad||' lost-sample-flag'; else ok := ok+1; end if;
  -- remove.sql removes them all
  delete from residences where is_sample;
  select count(*) into n from residences where is_sample; if n <> 0 then bad := bad||' remove='||n; else ok := ok+1; end if;
  raise exception 'ROLLBACK_TEST_RESULT passed=% failed=[%]', ok, bad;
end $t$;
'''
print('begin;\n' + mig + seed + test + 'rollback;')
