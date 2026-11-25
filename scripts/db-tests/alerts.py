# Rolled-back database test for alerts. Prints one SQL transaction that applies the migration, runs the checks
# and then fails on purpose so nothing is kept. Run from the repo root:
#   python3 -I scripts/db-tests/alerts.py > /tmp/alerts.sql && supabase db query --linked --file /tmp/alerts.sql
# Expect: ROLLBACK_TEST_RESULT passed=36 failed=[]. Only for a database where the migration is NOT yet applied;
# once it is, run it on a branch database or drop the migration part.
# Builds one transaction: the migration, then checks as real roles, then a forced error that undoes everything.
import json
mig=open('supabase/migrations/20261125100000_alerts.sql').read()
cases=json.load(open('src/lib/alertPriceCases.json'))
q=lambda s:"'"+s.replace("'","''")+"'"
t='''
do $t$
declare
  admin uuid := gen_random_uuid(); saver uuid := gen_random_uuid(); fit uuid := gen_random_uuid();
  poor uuid := gen_random_uuid(); other uuid := gen_random_uuid(); woman uuid := gen_random_uuid(); off uuid := gen_random_uuid();
  u uuid; rid uuid; rid2 uuid; rm uuid; stu uuid; n int; ok int := 0; bad text := ''; a int; b int; got int;
  c jsonb; room jsonb;
  base jsonb; rooms jsonb; terms jsonb := '{"referral_fee_percent": 5}';
begin
  foreach u in array array[admin,saver,fit,poor,other,woman,off] loop
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
    values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rb-'||u||'@havenly-e2e.test', '{"display_name":"RB"}');
    insert into profiles (id, username, display_name) values (u, 'rb_'||substr(replace(u::text,'-',''),1,20), 'RB') on conflict (id) do nothing;
  end loop;
  update profiles set is_admin = true where id = admin;
  update profiles set university = 'Uni A' where id in (saver, fit, poor, woman, off);
  update profiles set university = 'Uni B' where id = other;
  insert into profile_private (user_id, budget_aed, alert_new_places) values (fit, 3300, true), (poor, 1000, true), (other, 9000, true), (off, 9000, false);
  insert into profile_private (user_id, budget_aed, alert_new_places, gender) values (woman, 3300, true, 'female');

  -- 1. The price rule, the same cases the app tests run.
  for c in select * from jsonb_array_elements(CASES) loop
    insert into residences (name, provider_name, area, student_rate_aed) values ('RB case','x','x',(c->>'studentRate')::int) returning id into rid2;
    for room in select * from jsonb_array_elements(c->'rooms') loop
      insert into room_types (residence_id,name,price_aed,billing_period,is_available) values (rid2,'r',(room->>0)::int,room->>1,(room->>2)::boolean);
    end loop;
    got := private.listing_from_aed(rid2);
    if got is distinct from (c->>'from')::int then bad := bad || ' price:' || (c->>'name') || '=' || coalesce(got::text,'null'); else ok := ok+1; end if;
    delete from residences where id = rid2;
  end loop;

  perform set_config('request.jwt.claims', json_build_object('sub', admin, 'role','authenticated')::text, true);
  base := jsonb_build_object('name','RB Home','provider_name','x','area','Marina','nearby_universities', jsonb_build_array('Uni A'),'is_active',true,'listing_type','residence');

  -- 2. Saved with no university first, then fixed within the week.
  rooms := '[{"name":"A","price_aed":3200,"billing_period":"month","occupancy":1,"is_available":true}]';
  rid := save_residence(null, base || '{"nearby_universities": []}', rooms, terms);
  select count(*) into n from notifications where residence_id = rid;
  if n <> 0 then bad := bad||' before-fix='||n; else ok:=ok+1; end if;
  select id into rm from room_types where residence_id = rid;
  rooms := jsonb_build_array((rooms->0) || jsonb_build_object('id', rm));
  perform save_residence(rid, base, rooms, terms);
  select count(*) into n from notifications where residence_id = rid and type='new_place';
  select count(*) into a from notifications where residence_id = rid and type='new_place' and recipient_id in (fit, woman) and actor_id is null and new_price_aed = 3200;
  if n <> 2 or a <> 2 then bad := bad||' new-match='||n||'/'||a; else ok:=ok+1; end if;

  perform save_residence(rid, base, rooms, terms);
  perform save_residence(rid, base || '{"is_active": false}', rooms, terms);
  select count(*) into n from notifications where residence_id = rid;
  if n <> 0 then bad := bad||' hidden-removes='||n; else ok:=ok+1; end if;
  perform save_residence(rid, base, rooms, terms);
  select count(*) into n from notifications where residence_id = rid and type='new_place';
  if n <> 2 then bad := bad||' reshow='||n; else ok:=ok+1; end if;
  update notifications set is_read = true where residence_id = rid;
  perform save_residence(rid, base || '{"is_active": false}', rooms, terms);
  perform save_residence(rid, base, rooms, terms);
  select count(*) into n from notifications where residence_id = rid and type='new_place';
  if n <> 2 then bad := bad||' never-twice='||n; else ok:=ok+1; end if;
  delete from notifications where residence_id = rid;
  update residences set first_announced_at = now() - interval '8 days' where id = rid;

  -- 3. Price drops. saver has default switches (no private row); off turned nothing; poor turns price alerts off.
  insert into saved_residences (user_id, residence_id) values (saver, rid), (poor, rid);
  update profile_private set alert_price_drops = false where user_id = poor;
  perform save_residence(rid, base, rooms, terms);
  perform save_residence(rid, base, jsonb_set(rooms,'{0,price_aed}','3300'), terms);
  select count(*) into n from notifications where residence_id = rid;
  if n <> 0 then bad := bad||' same-or-higher='||n; else ok:=ok+1; end if;
  perform save_residence(rid, base, jsonb_set(rooms,'{0,price_aed}','2900'), terms);
  select count(*), max(old_price_aed), max(new_price_aed) into n, a, b from notifications where residence_id = rid and type='price_drop' and recipient_id = saver;
  select count(*) into got from notifications where residence_id = rid;
  if n <> 1 or got <> 1 or a <> 3300 or b <> 2900 then bad := bad||' drop='||n||' all='||got||' '||coalesce(a,0)||'>'||coalesce(b,0); else ok:=ok+1; end if;
  perform save_residence(rid, base, jsonb_set(rooms,'{0,price_aed}','2700'), terms);
  select count(*), max(old_price_aed), max(new_price_aed) into n, a, b from notifications where residence_id = rid and type='price_drop';
  if n <> 1 or a <> 3300 or b <> 2700 then bad := bad||' second-drop='||n||' '||a||'>'||b; else ok:=ok+1; end if;
  perform save_residence(rid, base, jsonb_set(rooms,'{0,price_aed}','3100'), terms);
  select count(*), max(new_price_aed) into n, b from notifications where residence_id = rid and type='price_drop';
  if n <> 1 or b <> 3100 then bad := bad||' small-raise='||n||' '||coalesce(b,0); else ok:=ok+1; end if;
  perform save_residence(rid, base, jsonb_set(rooms,'{0,price_aed}','3300'), terms);
  select count(*) into n from notifications where residence_id = rid;
  if n <> 0 then bad := bad||' back-to-was='||n; else ok:=ok+1; end if;
  -- student rate added counts as a cut; hiding removes it
  perform save_residence(rid, base || '{"student_rate_aed": 3000}', jsonb_set(rooms,'{0,price_aed}','3300'), terms);
  select count(*) into n from notifications where residence_id = rid and type='price_drop' and new_price_aed = 3000;
  if n <> 1 then bad := bad||' rate-cut='||n; else ok:=ok+1; end if;
  perform save_residence(rid, base || '{"is_active": false, "student_rate_aed": 3000}', jsonb_set(rooms,'{0,price_aed}','3300'), terms);
  select count(*) into n from notifications where residence_id = rid;
  if n <> 0 then bad := bad||' hidden-drop='||n; else ok:=ok+1; end if;
  -- cut made while hidden, then shown: no alert
  perform save_residence(rid, base || '{"student_rate_aed": null}', jsonb_set(rooms,'{0,price_aed}','2000'), terms);
  select count(*) into n from notifications where residence_id = rid;
  if n <> 0 then bad := bad||' shown-again='||n; else ok:=ok+1; end if;
  -- a cheaper room filling up and freeing again is not a cut
  perform save_residence(rid, base, jsonb_set(rooms,'{0,price_aed}','2900') || '[{"name":"B","price_aed":3500,"billing_period":"month","occupancy":1,"is_available":true}]', terms);
  delete from notifications where residence_id = rid;
  select jsonb_agg(jsonb_build_object('id',id,'name',name,'price_aed',price_aed,'billing_period',billing_period,'occupancy',occupancy,'is_available',is_available) order by sort_order) into rooms from room_types where residence_id = rid;
  perform save_residence(rid, base, jsonb_set(rooms,'{0,is_available}','false'), terms);
  perform save_residence(rid, base, rooms, terms);
  select count(*) into n from notifications where residence_id = rid;
  if n <> 0 then bad := bad||' reopen='||n; else ok:=ok+1; end if;
  -- adding a cheaper room is not a cut
  perform save_residence(rid, base, rooms || '[{"name":"C","price_aed":2000,"billing_period":"month","occupancy":1,"is_available":true}]', terms);
  select count(*) into n from notifications where residence_id = rid;
  if n <> 0 then bad := bad||' added-room='||n; else ok:=ok+1; end if;

  -- 4. Full with a student rate is never announced; whole home uses one share; gender.
  rid2 := save_residence(null, base || '{"name":"RB Full","student_rate_aed":1500}', '[{"name":"A","price_aed":3000,"billing_period":"month","occupancy":1,"is_available":false}]', terms);
  select count(*) into n from notifications where residence_id = rid2;
  select (first_announced_at is null)::int into a from residences where id = rid2;
  if n <> 0 or a <> 1 then bad := bad||' full='||n; else ok:=ok+1; end if;
  rid2 := save_residence(null, base || '{"name":"RB Share","listing_type":"home","bedrooms":3,"gender_policy":"female_only"}', '[{"name":"Whole","price_aed":9000,"billing_period":"month","occupancy":3,"is_available":true}]', terms);
  select count(*), count(*) filter (where recipient_id = woman) into n, a from notifications where residence_id = rid2;
  if n <> 1 or a <> 1 then bad := bad||' women-only-share='||n||'/'||a; else ok:=ok+1; end if;
  -- deleting the listing removes its alerts
  delete from residences where id = rid2;
  select count(*) into n from notifications where residence_id = rid2;
  if n <> 0 then bad := bad||' cascade'; else ok:=ok+1; end if;

  -- 5. As a signed-in student: no creating, only the read mark, only own switches, no calling the helpers.
  perform save_residence(rid, base, jsonb_set(rooms,'{0,price_aed}','1900'), terms);
  perform set_config('request.jwt.claims', json_build_object('sub', saver, 'role','authenticated')::text, true);
  set local role authenticated;
  begin insert into notifications (recipient_id,type,residence_id,new_price_aed) values (saver,'price_drop',rid,1); bad:=bad||' student-insert'; exception when others then ok:=ok+1; end;
  begin update notifications set new_price_aed = 1 where recipient_id = saver; bad:=bad||' student-rewrite'; exception when others then ok:=ok+1; end;
  begin update notifications set is_read = true where recipient_id = saver; get diagnostics n = row_count; if n >= 1 then ok:=ok+1; else bad:=bad||' mark-read=0'; end if; exception when others then bad:=bad||' mark-read:'||sqlerrm; end;
  update profile_private set alert_new_places = true where user_id = fit; get diagnostics n = row_count;
  if n <> 0 then bad:=bad||' other-switch'; else ok:=ok+1; end if;
  begin insert into profile_private (user_id, alert_new_places) values (saver, true); update profile_private set alert_price_drops=false where user_id=saver; ok:=ok+1; exception when others then bad:=bad||' own-switch:'||sqlerrm; end;
  begin perform private.send_listing_alerts(rid, '{}'); bad:=bad||' student-call'; exception when others then ok:=ok+1; end;
  begin perform save_residence(rid, base, rooms, terms); bad:=bad||' student-save'; exception when others then ok:=ok+1; end;
  reset role;

  -- 6. Enquiry notifications still arrive.
  insert into housing_enquiries (user_id,residence_id,kind,move_in_month,duration_months,contact_phone)
  values (saver, rid, 'question', date_trunc('month', now() + interval '1 month')::date, 12, '+971 50 000 0000') returning id into rm;
  select count(*) into n from notifications where enquiry_id = rm and type='enquiry_new' and actor_id = saver;
  if n < 1 then bad:=bad||' enquiry-new'; else ok:=ok+1; end if;
  update housing_enquiries set status='contacted' where id = rm;
  select count(*) into n from notifications where enquiry_id = rm and type='enquiry_status' and recipient_id = saver;
  if n <> 1 then bad:=bad||' enquiry-status='||n; else ok:=ok+1; end if;

  raise exception 'ROLLBACK_TEST_RESULT passed=% failed=[%]', ok, bad;
end
$t$;
'''.replace('CASES', q(json.dumps(cases))+'::jsonb')
print('begin;\n'+mig+t+'rollback;')
