-- Posts can now carry a video alongside (in place of) the image: image_url
-- becomes the poster/thumbnail frame (used everywhere a thumbnail already
-- renders — Feed grid, Profile grid, Discover search), video_url is the
-- actual clip, only played from PostDetail. Client enforces a 60s cap at
-- pick time to keep storage cost predictable; file_size_limit below is a
-- backstop against an unexpectedly high-bitrate file slipping past that.
alter table posts add column video_url text;

insert into storage.buckets (id, name, public, file_size_limit) values ('post-videos', 'post-videos', true, 104857600)
on conflict (id) do nothing;
create policy "Post videos are publicly viewable" on storage.objects for select using (bucket_id = 'post-videos');
create policy "Users can upload their own post videos" on storage.objects for insert with check (
  bucket_id = 'post-videos' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "Users can delete their own post videos" on storage.objects for delete using (
  bucket_id = 'post-videos' and auth.uid()::text = (storage.foldername(name))[1]
);
