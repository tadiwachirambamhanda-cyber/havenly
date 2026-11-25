-- Codex review round 3 (plans/2026-11-25-v2-foundation.md): posts outside any community (the 4 old posts from the
-- archived social app) were still readable by signed-in students if asked for directly. In v2 every post lives in a
-- community, so the old ones are now seen only by their author and the team (a Chat message that shared one reads
-- "Shared a post (no longer available)").
drop policy "Signed-in students see posts that are not hidden" on public.posts;
create policy "Signed-in students see posts that are not hidden" on public.posts
  for select to authenticated using (
    not private.is_blocked_between(auth.uid(), author_id)
    and ((hidden_at is null and community_id is not null) or author_id = auth.uid() or private.is_admin())
  );
