-- Lets a post optionally belong to a community, reusing the existing
-- post/comment/like system instead of building separate community
-- infrastructure. Nullable: most posts (editorial, general feed) belong to
-- no community. Posting into a community requires membership, enforced here
-- rather than just in the UI.
alter table posts add column community_id uuid references communities(id) on delete set null;
create index posts_community_idx on posts (community_id, created_at);

drop policy "Users can create their own posts" on posts;
create policy "Users can create their own posts" on posts for insert with check (
  auth.uid() = author_id
  and (
    community_id is null
    or exists (select 1 from community_members where community_id = posts.community_id and user_id = auth.uid())
  )
);
