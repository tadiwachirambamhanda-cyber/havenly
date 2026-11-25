# Rolled-back database test for the v2 community migration. Prints one SQL transaction that applies the
# migration, runs the checks as real roles (signed out, students, the team) on the live data, and then fails
# on purpose so nothing is kept. Run from the repo root:
#   python3 -I scripts/db-tests/community.py > /tmp/community.sql && supabase db query --linked --file /tmp/community.sql
# Expect: ROLLBACK_TEST_RESULT passed=N failed=[]. Only for a database where the migration is NOT yet applied.
mig = open('supabase/migrations/20261125200000_community_v2.sql').read()

test = r'''
create function pg_temp.as_user(u uuid) returns void language plpgsql as $f$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $f$;

do $t$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  e uuid := gen_random_uuid(); fresh uuid := gen_random_uuid(); adm uuid := gen_random_uuid();
  u uuid; x uuid; y uuid; pid uuid; rid uuid; cid uuid; eid uuid; oid uuid; bid uuid;
  n int; m int; ok int := 0; bad text := ''; code1 text; code2 text; again boolean; old_posts int;
begin
  select count(*) into old_posts from posts where community_id is null;
  foreach u in array array[a, b, c, d, e, fresh, adm] loop
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
    values (u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rb-' || u || '@havenly-e2e.test', '{"display_name":"RB"}');
    insert into profiles (id, username, display_name) values (u, 'rb_' || substr(replace(u::text, '-', ''), 1, 20), 'RB') on conflict (id) do nothing;
  end loop;
  update profiles set created_at = now() - interval '3 days' where id in (a, b, c, d, e, adm);
  update profiles set is_admin = true where id = adm;
  update profiles set university = 'RB University A' where id = a;
  select id into x from communities where category = 'campus' order by name limit 1;
  select id into y from communities where category = 'campus' order by name desc limit 1;

  -- 1. Join a community of another university.
  perform pg_temp.as_user(a);
  begin insert into community_members (community_id, user_id) values (x, a); ok := ok + 1; exception when others then bad := bad || ' join:' || sqlerrm; end;
  -- 2. A non-member cannot post; a member posts with 4 photos and an area tag.
  begin insert into posts (author_id, body, community_id) values (a, 'no', y); bad := bad || ' nonmember-post'; exception when others then ok := ok + 1; end;
  begin
    insert into posts (author_id, body, community_id, area, image_paths)
    values (a, 'Anyone in JLT?', x, 'RB Test Area', array[a || '/1.jpg', a || '/2.jpg', a || '/3.jpg', a || '/4.jpg']) returning id into pid;
    ok := ok + 1;
  exception when others then bad := bad || ' post:' || sqlerrm; end;
  begin insert into posts (author_id, body, community_id, image_paths) values (a, 'five', x, array[a || '/1', a || '/2', a || '/3', a || '/4', a || '/5']); bad := bad || ' five-photos'; exception when others then ok := ok + 1; end;
  begin insert into posts (author_id, body, community_id, image_paths) values (a, 'other folder', x, array[b || '/1.jpg']); bad := bad || ' other-folder'; exception when others then ok := ok + 1; end;
  begin insert into posts (author_id, body, community_id) values (b, 'as someone else', x); bad := bad || ' spoof-author'; exception when others then ok := ok + 1; end;
  reset role;

  -- 3. Signed out sees no posts, memberships or events, and cannot call the listing function.
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  select count(*) into n from posts;
  if n <> 0 then bad := bad || ' anon-posts=' || n; else ok := ok + 1; end if;
  select count(*) into n from community_members;
  if n <> 0 then bad := bad || ' anon-members=' || n; else ok := ok + 1; end if;
  begin perform public.area_posts(gen_random_uuid(), 3); bad := bad || ' anon-area-posts'; exception when others then ok := ok + 1; end;
  reset role;

  -- 4. Join limit: 20 at once.
  insert into community_members (community_id, user_id)
  select id, a from communities where id <> x order by name limit 19;
  perform pg_temp.as_user(a);
  begin insert into community_members (community_id, user_id) values (y, a); bad := bad || ' 21st-join'; exception when others then ok := ok + 1; end;
  reset role;
  delete from community_members where user_id = a and community_id <> x;

  -- 5. Listing page: posts tagged with the listing's area show; hidden ones do not.
  insert into residences (name, provider_name, area) values ('RB Home', 'RB', 'RB Test Area') returning id into rid;
  perform pg_temp.as_user(b);
  select count(*) into n from public.area_posts(rid, 3);
  if n <> 1 then bad := bad || ' area-posts=' || n; else ok := ok + 1; end if;
  reset role;

  -- 6. Reports: not your own, not missing, one each, fresh accounts do not count, 3 hide it.
  perform pg_temp.as_user(a);
  begin perform public.report_item('post', pid, 'spam'); bad := bad || ' self-report'; exception when others then ok := ok + 1; end;
  reset role;
  perform pg_temp.as_user(b);
  begin perform public.report_item('post', gen_random_uuid(), 'spam'); bad := bad || ' missing-report'; exception when others then ok := ok + 1; end;
  begin perform public.report_item('post', pid, 'because'); bad := bad || ' bad-reason'; exception when others then ok := ok + 1; end;
  begin insert into reports (reporter_id, target_type, target_id, reason) values (b, 'post', pid, 'spam'); bad := bad || ' direct-post-report'; exception when others then ok := ok + 1; end;
  begin insert into reports (reporter_id, target_type, target_id, reason) values (b, 'user', a, 'spam'); ok := ok + 1; exception when others then bad := bad || ' direct-user-report:' || sqlerrm; end;
  perform public.report_item('post', pid, 'spam');
  perform public.report_item('post', pid, 'spam');
  reset role;
  perform pg_temp.as_user(c); perform public.report_item('post', pid, 'scam'); reset role;
  perform pg_temp.as_user(fresh); perform public.report_item('post', pid, 'spam'); reset role;
  select count(*) into n from posts where id = pid and hidden_at is not null;
  if n <> 0 then bad := bad || ' hidden-too-early'; else ok := ok + 1; end if;
  select count(*) into n from reports where target_id = pid and reporter_id = b;
  if n <> 1 then bad := bad || ' duplicate-report=' || n; else ok := ok + 1; end if;
  perform pg_temp.as_user(d); perform public.report_item('post', pid, 'spam'); reset role;
  select count(*) into n from posts where id = pid and hidden_at is not null;
  if n <> 1 then bad := bad || ' not-hidden-at-3'; else ok := ok + 1; end if;

  -- 7. Hidden: others cannot see it or like or comment; the author and the team can see it.
  perform pg_temp.as_user(e);
  select count(*) into n from posts where id = pid;
  if n <> 0 then bad := bad || ' hidden-visible'; else ok := ok + 1; end if;
  begin perform public.toggle_post_like(pid); bad := bad || ' like-hidden'; exception when others then ok := ok + 1; end;
  begin insert into comments (post_id, author_id, body) values (pid, e, 'hi'); bad := bad || ' comment-hidden'; exception when others then ok := ok + 1; end;
  select count(*) into n from public.area_posts(rid, 3);
  if n <> 0 then bad := bad || ' area-hidden=' || n; else ok := ok + 1; end if;
  reset role;
  perform pg_temp.as_user(a); select count(*) into n from posts where id = pid; reset role;
  if n <> 1 then bad := bad || ' author-cannot-see'; else ok := ok + 1; end if;
  perform pg_temp.as_user(adm); select count(*) into n from posts where id = pid; reset role;
  if n <> 1 then bad := bad || ' team-cannot-see'; else ok := ok + 1; end if;

  -- 8. Reporters stay private; only the team has the queue.
  perform pg_temp.as_user(b);
  select count(*) into n from reports where target_id = pid;
  if n <> 1 then bad := bad || ' sees-other-reports=' || n; else ok := ok + 1; end if;
  begin perform * from public.review_queue(); bad := bad || ' student-queue'; exception when others then ok := ok + 1; end;
  begin perform public.decide_report('post', pid, 'keep'); bad := bad || ' student-decide'; exception when others then ok := ok + 1; end;
  reset role;
  perform pg_temp.as_user(adm);
  select reports into n from public.review_queue() q where q.target_id = pid;
  if coalesce(n, 0) < 3 then bad := bad || ' queue=' || coalesce(n, 0); else ok := ok + 1; end if;
  perform public.decide_report('post', pid, 'keep');
  reset role;
  perform pg_temp.as_user(e);
  select count(*) into n from posts where id = pid;
  if n <> 1 then bad := bad || ' keep-not-visible'; else ok := ok + 1; end if;
  -- likes and comments work on a visible post
  begin perform public.toggle_post_like(pid); insert into comments (post_id, author_id, body) values (pid, e, 'Bus 84') returning id into cid; ok := ok + 1; exception when others then bad := bad || ' like-comment:' || sqlerrm; end;
  reset role;
  select count(*) into n from reports where target_id = pid and status = 'pending';
  if n <> 0 then bad := bad || ' reports-still-open=' || n; else ok := ok + 1; end if;

  -- 9. Events: Going toggles the count; a hidden event disappears for students.
  perform pg_temp.as_user(adm);
  insert into events (title, location, tag, event_date, community_id) values ('RB meetup', 'RB place', 'study', now() + interval '3 days', x) returning id into eid;
  reset role;
  perform pg_temp.as_user(b);
  insert into event_going (event_id, user_id) values (eid, b);
  begin insert into event_going (event_id, user_id) values (eid, b); bad := bad || ' going-twice'; exception when others then ok := ok + 1; end;
  reset role;
  select going_count into n from events where id = eid;
  if n <> 1 then bad := bad || ' going=' || n; else ok := ok + 1; end if;
  perform pg_temp.as_user(b); delete from event_going where event_id = eid and user_id = b; reset role;
  select going_count into n from events where id = eid;
  if n <> 0 then bad := bad || ' not-going=' || n; else ok := ok + 1; end if;
  perform pg_temp.as_user(b); perform public.report_item('event', eid, 'scam'); reset role;
  perform pg_temp.as_user(c); perform public.report_item('event', eid, 'scam'); reset role;
  perform pg_temp.as_user(d); perform public.report_item('event', eid, 'scam'); reset role;
  perform pg_temp.as_user(e);
  select count(*) into n from events where id = eid;
  if n <> 0 then bad := bad || ' hidden-event-visible'; else ok := ok + 1; end if;
  begin insert into event_going (event_id, user_id) values (eid, e); bad := bad || ' going-hidden'; exception when others then ok := ok + 1; end;
  reset role;

  -- 10. Comments can be reported and hidden too.
  perform pg_temp.as_user(b); perform public.report_item('comment', cid, 'harassment'); reset role;
  perform pg_temp.as_user(c); perform public.report_item('comment', cid, 'harassment'); reset role;
  perform pg_temp.as_user(d); perform public.report_item('comment', cid, 'harassment'); reset role;
  perform pg_temp.as_user(a);
  select count(*) into n from comments where id = cid;
  if n <> 0 then bad := bad || ' hidden-comment-visible'; else ok := ok + 1; end if;
  reset role;

  -- 11. Perks: no streak needed; the same code every time.
  insert into brands (name, category) values ('RB Brand', 'cafe') returning id into bid;
  insert into offers (brand_id, title, discount_label, min_streak, starts_at, is_active) values (bid, 'RB perk', '10% off', 30, now() - interval '1 day', true) returning id into oid;
  perform pg_temp.as_user(b);
  select code, already_claimed into code1, again from public.claim_offer(oid);
  if code1 is null or again then bad := bad || ' claim1'; else ok := ok + 1; end if;
  select code, already_claimed into code2, again from public.claim_offer(oid);
  if code2 is distinct from code1 or not again then bad := bad || ' claim2'; else ok := ok + 1; end if;
  reset role;

  -- 12. Old posts untouched; housing still works.
  select count(*) into n from posts where community_id is null;
  if n <> old_posts then bad := bad || ' old-posts'; else ok := ok + 1; end if;
  perform pg_temp.as_user(b);
  begin insert into saved_residences (user_id, residence_id) values (b, rid); ok := ok + 1; exception when others then bad := bad || ' save:' || sqlerrm; end;
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
  begin select count(*) into n from residences; ok := ok + 1; exception when others then bad := bad || ' anon-listings:' || sqlerrm; end;
  reset role;

  raise exception 'ROLLBACK_TEST_RESULT passed=% failed=[%]', ok, bad;
end
$t$;
'''
print('begin;\n' + mig + test + 'rollback;')
