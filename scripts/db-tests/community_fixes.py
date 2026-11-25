# Rolled-back test for the v2 community fixes (Codex review). Run from the repo root, on a database where
# 20261125200000_community_v2 is applied and 20261125210000_community_v2_fixes is NOT yet:
#   python3 -I scripts/db-tests/community_fixes.py > /tmp/f.sql && supabase db query --linked --file /tmp/f.sql
# Expect: ROLLBACK_TEST_RESULT passed=N failed=[].
mig = open('supabase/migrations/20261125210000_community_v2_fixes.sql').read()
test = r'''
create function pg_temp.as_user(u uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $f$;
do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  f1 uuid := gen_random_uuid(); f2 uuid := gen_random_uuid(); f3 uuid := gen_random_uuid(); adm uuid := gen_random_uuid();
  u uuid; x uuid; pid uuid; pid2 uuid; cid uuid; n int; ok int := 0; bad text := '';
begin
  foreach u in array array[a, b, c, d, f1, f2, f3, adm] loop
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
    values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rb-' || u || '@havenly-e2e.test', '{"display_name":"RB"}');
    insert into profiles (id, username, display_name) values (u, 'rb_' || substr(replace(u::text, '-', ''), 1, 20), 'RB') on conflict (id) do nothing;
  end loop;
  update profiles set created_at = now() - interval '3 days' where id in (a, b, c, d, adm, f1, f2, f3);
  update profiles set is_admin = true where id = adm;
  select id into x from communities where category = 'campus' order by name limit 1;
  insert into community_members (community_id, user_id) values (x, a), (x, b);
  insert into posts (author_id, body, community_id) values (a, 'RB post', x) returning id into pid;
  insert into posts (author_id, body, community_id) values (a, 'RB post 2', x) returning id into pid2;
  insert into comments (post_id, author_id, body) values (pid, b, 'RB comment') returning id into cid;

  -- 1. Memberships: own only; the team sees all.
  perform pg_temp.as_user(b);
  select count(*) into n from community_members where user_id = a;
  if n <> 0 then bad := bad || ' sees-others-membership'; else ok := ok + 1; end if;
  select count(*) into n from community_members where user_id = b;
  if n <> 1 then bad := bad || ' own-membership=' || n; else ok := ok + 1; end if;
  reset role;
  perform pg_temp.as_user(adm); select count(*) into n from community_members where user_id in (a, b); reset role;
  if n <> 2 then bad := bad || ' team-memberships=' || n; else ok := ok + 1; end if;

  -- 2. Comments go with a hidden post.
  update posts set hidden_at = now() where id = pid;
  perform pg_temp.as_user(c); select count(*) into n from comments where id = cid; reset role;
  if n <> 0 then bad := bad || ' comment-of-hidden-post'; else ok := ok + 1; end if;
  perform pg_temp.as_user(a); select count(*) into n from comments where id = cid; reset role;
  if n <> 1 then bad := bad || ' author-loses-comments'; else ok := ok + 1; end if;
  update posts set hidden_at = null where id = pid;
  perform pg_temp.as_user(c); select count(*) into n from comments where id = cid; reset role;
  if n <> 1 then bad := bad || ' comment-of-visible-post'; else ok := ok + 1; end if;

  -- 3. The limit still holds (and joining still works).
  insert into community_members (community_id, user_id) select id, c from communities order by name limit 19;
  perform pg_temp.as_user(c);
  begin insert into community_members (community_id, user_id) select id, c from communities order by name desc limit 1; ok := ok + 1; exception when others then bad := bad || ' 20th:' || sqlerrm; end;
  begin insert into community_members (community_id, user_id) select id, c from communities where id not in (select community_id from community_members where user_id = c) limit 1; bad := bad || ' 21st'; exception when others then ok := ok + 1; end;
  reset role;

  -- 4. Reports made while an account was under a day old never count, even after it ages.
  perform pg_temp.as_user(f1); perform public.report_item('post', pid2, 'spam'); reset role;
  perform pg_temp.as_user(f2); perform public.report_item('post', pid2, 'spam'); reset role;
  update reports set created_at = now() - interval '2 days 23 hours' where target_id = pid2;
  perform pg_temp.as_user(d); perform public.report_item('post', pid2, 'spam'); reset role;
  select count(*) into n from posts where id = pid2 and hidden_at is not null;
  if n <> 0 then bad := bad || ' fresh-reports-counted-later'; else ok := ok + 1; end if;
  perform pg_temp.as_user(b); perform public.report_item('post', pid2, 'spam'); reset role;
  perform pg_temp.as_user(c); perform public.report_item('post', pid2, 'spam'); reset role;
  select count(*) into n from posts where id = pid2 and hidden_at is not null;
  if n <> 1 then bad := bad || ' three-real-reports-not-hidden'; else ok := ok + 1; end if;

  raise exception 'ROLLBACK_TEST_RESULT passed=% failed=[%]', ok, bad;
end
$t$;
'''
print('begin;\n' + mig + test + 'rollback;')
