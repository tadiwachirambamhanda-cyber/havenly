-- The seed data gave communities and editorial posts invented member and
-- like counts (16,302 members shown against 4 real joins; 5,843 likes
-- against 2). Showing them would be fake social proof, so reset both to
-- what actually exists. The existing triggers/RPC keep them in sync from
-- here, since they only ever add or subtract one.
update communities c
set member_count = (select count(*) from community_members m where m.community_id = c.id);

update posts p
set like_count = (select count(*) from post_likes l where l.post_id = p.id);

update posts p
set comment_count = (select count(*) from comments cm where cm.post_id = p.id);
