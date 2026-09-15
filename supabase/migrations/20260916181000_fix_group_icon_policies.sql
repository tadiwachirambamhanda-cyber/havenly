-- The previous migration's group-icons policies had a real bug: inside
-- "exists (select 1 from conversations c where c.id::text =
-- (storage.foldername(name))[1] ...)", the bare `name` was ambiguous
-- between storage.objects.name (the file path — what was intended) and
-- conversations.name (the group's display name, added in the same
-- migration that added icon_url) — Postgres silently resolved it to the
-- nearer c.name instead, so the check was reading the group's name as if
-- it were a file path and every upload was rejected. Schema-qualifying
-- storage.objects.name fixes it.
drop policy "Group members can upload a group icon" on storage.objects;
drop policy "Group members can update a group icon" on storage.objects;
drop policy "Group members can delete a group icon" on storage.objects;

create policy "Group members can upload a group icon" on storage.objects for insert with check (
  bucket_id = 'group-icons' and exists (
    select 1 from conversations c where c.id::text = (storage.foldername(storage.objects.name))[1]
      and c.is_group and auth.uid() = any(c.participant_ids)
  )
);
create policy "Group members can update a group icon" on storage.objects for update using (
  bucket_id = 'group-icons' and exists (
    select 1 from conversations c where c.id::text = (storage.foldername(storage.objects.name))[1]
      and c.is_group and auth.uid() = any(c.participant_ids)
  )
);
create policy "Group members can delete a group icon" on storage.objects for delete using (
  bucket_id = 'group-icons' and exists (
    select 1 from conversations c where c.id::text = (storage.foldername(storage.objects.name))[1]
      and c.is_group and auth.uid() = any(c.participant_ids)
  )
);
