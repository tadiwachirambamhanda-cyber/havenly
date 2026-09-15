-- Lets a group have its own photo instead of always the generic icon.
-- Nullable — no icon set just keeps showing that fallback, same pattern as
-- a missing avatar_url/cover_url.
alter table conversations add column icon_url text;

-- conversations' update grant was column-scoped to (status, last_message,
-- last_message_at) — icon_url and name need adding so a group member can
-- actually rename a group or set its icon from the client. The "Group
-- participants can update conversation" RLS policy already allows any
-- current member to write these once granted; it doesn't restrict which
-- columns, only the GRANT does that.
grant update (icon_url, name) on conversations to authenticated;

-- Different shape from avatars/covers: those are folder-scoped by the
-- owning user's own uid, but a group icon has no single owner — any
-- current member should be able to set it. Objects are stored at
-- "<conversation_id>/<file>", so the check is membership in that specific
-- group rather than auth.uid() matching the folder name.
insert into storage.buckets (id, name, public) values ('group-icons', 'group-icons', true)
on conflict (id) do nothing;
create policy "Group icons are publicly viewable" on storage.objects for select using (bucket_id = 'group-icons');
create policy "Group members can upload a group icon" on storage.objects for insert with check (
  bucket_id = 'group-icons' and exists (
    select 1 from conversations c where c.id::text = (storage.foldername(name))[1]
      and c.is_group and auth.uid() = any(c.participant_ids)
  )
);
create policy "Group members can update a group icon" on storage.objects for update using (
  bucket_id = 'group-icons' and exists (
    select 1 from conversations c where c.id::text = (storage.foldername(name))[1]
      and c.is_group and auth.uid() = any(c.participant_ids)
  )
);
create policy "Group members can delete a group icon" on storage.objects for delete using (
  bucket_id = 'group-icons' and exists (
    select 1 from conversations c where c.id::text = (storage.foldername(name))[1]
      and c.is_group and auth.uid() = any(c.participant_ids)
  )
);
