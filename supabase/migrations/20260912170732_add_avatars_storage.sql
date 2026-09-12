-- Separate from post-images: a different concern (one profile photo per
-- user vs. many post photos), kept in its own bucket for clarity even
-- though the RLS pattern is identical (public read, path-scoped write).
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatars are publicly viewable" on storage.objects for select using (bucket_id = 'avatars');

create policy "Users can upload their own avatar" on storage.objects for insert with check (
  bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update their own avatar" on storage.objects for update using (
  bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own avatar" on storage.objects for delete using (
  bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
);
