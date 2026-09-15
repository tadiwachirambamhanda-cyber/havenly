-- Lets a profile show a real cover photo behind the avatar instead of
-- always the same fixed gradient. Nullable — no cover set just keeps
-- showing that gradient, same fallback pattern as a missing avatar_url.
alter table profiles add column cover_url text;

-- Same bucket/RLS shape as avatars — one cover photo per user, folder-scoped
-- to their own uid so the insert/update/delete policies can check it.
insert into storage.buckets (id, name, public) values ('covers', 'covers', true)
on conflict (id) do nothing;
create policy "Covers are publicly viewable" on storage.objects for select using (bucket_id = 'covers');
create policy "Users can upload their own cover" on storage.objects for insert with check (
  bucket_id = 'covers' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "Users can update their own cover" on storage.objects for update using (
  bucket_id = 'covers' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "Users can delete their own cover" on storage.objects for delete using (
  bucket_id = 'covers' and auth.uid()::text = (storage.foldername(name))[1]
);
