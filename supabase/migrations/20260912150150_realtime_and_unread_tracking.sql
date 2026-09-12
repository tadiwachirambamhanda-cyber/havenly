-- Tracks the last time each user viewed each conversation, so Inbox can show
-- a real per-thread unread indicator (and the nav bar can show a real unread
-- dot) instead of faking one.
create table conversation_reads (
  conversation_id uuid references conversations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table conversation_reads enable row level security;
create policy "Users can view their own read state" on conversation_reads for select using (auth.uid() = user_id);
create policy "Users can set their own read state" on conversation_reads for insert with check (auth.uid() = user_id);
create policy "Users can update their own read state" on conversation_reads for update using (auth.uid() = user_id);

-- Postgres tables are NOT broadcast to Supabase Realtime unless explicitly
-- added here — this was missing for every messaging table, which is why
-- ChatScreen's `.channel().on('postgres_changes', ...)` subscriptions were
-- silently receiving nothing (no error — they just never fired). A plain
-- refetch (e.g. leaving and reopening the chat) always worked because that's
-- a normal query, unaffected by publication membership.
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table conversation_reads;
