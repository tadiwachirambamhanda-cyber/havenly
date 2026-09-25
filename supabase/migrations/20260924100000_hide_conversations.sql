-- Lets someone remove a conversation from just their own Inbox without
-- deleting it for the other participant(s) — the same "delete conversation"
-- behavior WhatsApp/iMessage use: it disappears from your list, but a new
-- message reappears it, since that's activity you'd want to see again.
-- Mirrors conversation_reads' shape (a small per-user marker table) rather
-- than adding a column to conversations, since conversations has no
-- per-user row to attach one to (participant_ids is a plain array).
create table conversation_hidden_for (
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table conversation_hidden_for enable row level security;
create policy "Users can view their own hidden conversations" on conversation_hidden_for for select using (auth.uid() = user_id);
create policy "Users can hide their own conversations" on conversation_hidden_for for insert with check (auth.uid() = user_id);
create policy "Users can update their own hide marker" on conversation_hidden_for for update using (auth.uid() = user_id);
-- Un-hiding (e.g. if this is ever exposed as an explicit "undo") just
-- deletes the row — no separate policy needed beyond owning the row.
create policy "Users can un-hide their own conversations" on conversation_hidden_for for delete using (auth.uid() = user_id);
