import { supabase } from '@/lib/supabase';

// Every bucket where a user's own uploads live under "<userId>/". Group
// icons and residence photos aren't here on purpose: they belong to a group
// or a residence, not to one person.
const STORAGE_BUCKETS = ['avatars', 'covers', 'post-images', 'post-videos'];
const PAGE_SIZE = 1000;

async function removeUserFiles(bucket: string, userId: string): Promise<void> {
  // list() returns at most PAGE_SIZE entries, so keep removing until the
  // folder comes back empty rather than stopping after the first page.
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(userId, { limit: PAGE_SIZE });
    if (error || !data?.length) return;
    const paths = data.map((f) => `${userId}/${f.name}`);
    const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
    if (removeError || data.length < PAGE_SIZE) return;
  }
}

// Permanently deletes the signed-in user's account. Storage files aren't
// covered by the database's cascading deletes, so they're removed first —
// while the session can still write to storage — then delete_own_account()
// removes the auth.users row (cascading to profile, posts, comments, etc.),
// then the local session is cleared so the UI reacts immediately.
export async function deleteOwnAccount(userId: string): Promise<void> {
  await Promise.all(STORAGE_BUCKETS.map((bucket) => removeUserFiles(bucket, userId)));

  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;

  await supabase.auth.signOut({ scope: 'local' });
}
