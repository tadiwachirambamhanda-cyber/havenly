# Rolled-back test for the private community photo store. Run from the repo root on a database where
# 20261125240000_community_photos is NOT yet applied:
#   python3 -I scripts/db-tests/community_photos.py > /tmp/p.sql && supabase db query --linked --file /tmp/p.sql
# Expect: ROLLBACK_TEST_RESULT passed=N failed=[].
mig = open('supabase/migrations/20261125240000_community_photos.sql').read()
test = r'''
create function pg_temp.as_user(u uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $f$;
do $t$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); adm uuid := gen_random_uuid();
  u uuid; x uuid; pid uuid; n int; ok int := 0; bad text := ''; p1 text; p2 text;
begin
  foreach u in array array[a, b, adm] loop
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
    values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rb-' || u || '@havenly-e2e.test', '{"display_name":"RB"}');
    insert into profiles (id, username, display_name) values (u, 'rb_' || substr(replace(u::text, '-', ''), 1, 20), 'RB') on conflict (id) do nothing;
  end loop;
  update profiles set is_admin = true where id = adm;
  p1 := a || '/one.jpg'; p2 := a || '/unused.jpg';
  select id into x from communities order by name limit 1;
  insert into community_members (community_id, user_id) values (x, a);

  -- Upload only into your own folder.
  perform pg_temp.as_user(a);
  begin insert into storage.objects (bucket_id, name, owner) values ('community-photos', p1, a); ok := ok + 1; exception when others then bad := bad || ' upload:' || sqlerrm; end;
  begin insert into storage.objects (bucket_id, name, owner) values ('community-photos', p2, a); ok := ok + 1; exception when others then bad := bad || ' upload2:' || sqlerrm; end;
  begin insert into storage.objects (bucket_id, name, owner) values ('community-photos', b || '/x.jpg', a); bad := bad || ' other-folder'; exception when others then ok := ok + 1; end;
  insert into posts (author_id, body, community_id, image_paths) values (a, 'RB', x, array[p1]) returning id into pid;
  reset role;

  -- Others see a photo only through a visible post; never an unused upload.
  perform pg_temp.as_user(b);
  select count(*) into n from storage.objects where bucket_id = 'community-photos' and name = p1;
  if n <> 1 then bad := bad || ' visible-post-photo=' || n; else ok := ok + 1; end if;
  select count(*) into n from storage.objects where bucket_id = 'community-photos' and name = p2;
  if n <> 0 then bad := bad || ' unused-upload-visible'; else ok := ok + 1; end if;
  reset role;
  update posts set hidden_at = now() where id = pid;
  perform pg_temp.as_user(b);
  select count(*) into n from storage.objects where bucket_id = 'community-photos' and name = p1;
  if n <> 0 then bad := bad || ' hidden-post-photo-visible'; else ok := ok + 1; end if;
  begin delete from storage.objects where bucket_id = 'community-photos' and name = p1; get diagnostics n = row_count; if n = 0 then ok := ok + 1; else bad := bad || ' deleted-others'; end if; exception when others then ok := ok + 1; end;
  reset role;
  perform pg_temp.as_user(a);
  select count(*) into n from storage.objects where bucket_id = 'community-photos' and name in (p1, p2);
  if n <> 2 then bad := bad || ' author-own=' || n; else ok := ok + 1; end if;
  reset role;
  perform pg_temp.as_user(adm);
  select count(*) into n from storage.objects where bucket_id = 'community-photos' and name = p1;
  if n <> 1 then bad := bad || ' team=' || n; else ok := ok + 1; end if;
  reset role;

  -- Signed out sees nothing; the store is private.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select count(*) into n from storage.objects where bucket_id = 'community-photos';
  if n <> 0 then bad := bad || ' anon=' || n; else ok := ok + 1; end if;
  reset role;
  select count(*) into n from storage.buckets where id = 'community-photos' and not public;
  if n <> 1 then bad := bad || ' not-private'; else ok := ok + 1; end if;

  raise exception 'ROLLBACK_TEST_RESULT passed=% failed=[%]', ok, bad;
end
$t$;
'''
print('begin;\n' + mig + test + 'rollback;')
