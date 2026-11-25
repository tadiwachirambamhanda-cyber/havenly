-- A private photo store for community posts (owner decision 2026-11-25). The old public post-images store keeps
-- the archived posts' photos as they are. Community photos live in community-photos, private: the app asks for a
-- short-lived link, and gets one only for a photo the student is allowed to see. A photo belongs to a post through
-- posts.image_paths, so when a post is hidden (or its author blocked) its photos stop opening for everyone else.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-photos', 'community-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

-- Upload and delete only inside your own folder (<your id>/<file>).
create policy "Students upload community photos to their own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'community-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Students delete their own community photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'community-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- See a photo when it is yours, or when it belongs to a post you can see. The check on posts runs with the
-- student's own rights, so hidden posts, blocked people and old community-less posts are left out by the posts rules.
create policy "Students see photos of posts they can see" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'community-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.posts p where p.image_paths @> array[storage.objects.name])
    )
  );

create index if not exists posts_image_paths_idx on public.posts using gin (image_paths);
