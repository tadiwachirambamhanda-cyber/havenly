-- ==================== COMMENTS ====================
alter table posts add column comment_count int not null default 0;

create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  author_id uuid references profiles(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now()
);
alter table comments enable row level security;
create policy "Comments are viewable unless blocked" on comments for select using (
  not public.is_blocked_between(auth.uid(), author_id)
);
create policy "Users can add comments" on comments for insert with check (auth.uid() = author_id);
create policy "Users can delete their own comments" on comments for delete using (auth.uid() = author_id);

-- Keeps posts.comment_count in sync regardless of insert/delete path.
-- security definer because "Users can update their own posts" would
-- otherwise block anyone but the post's author from touching this count.
create or replace function public.sync_post_comment_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger on_comment_change
  after insert or delete on comments
  for each row execute procedure public.sync_post_comment_count();

-- ==================== SAVED POSTS ====================
create table saved_posts (
  user_id uuid references profiles(id) on delete cascade,
  post_id uuid references posts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, post_id)
);
alter table saved_posts enable row level security;
create policy "Users can view their own saved posts" on saved_posts for select using (auth.uid() = user_id);
create policy "Users can save posts" on saved_posts for insert with check (auth.uid() = user_id);
create policy "Users can unsave posts" on saved_posts for delete using (auth.uid() = user_id);

create index comments_post_idx on comments (post_id, created_at);
create index saved_posts_user_idx on saved_posts (user_id);
