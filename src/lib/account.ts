import { supabase } from '@/lib/supabase';

const STORAGE_BUCKETS = ['avatars', 'post-images', 'post-videos'];

// Permanently deletes the signed-in user's account. Storage files aren't
// covered by the database's cascading deletes, so they're removed first —
// while the session can still write to storage — then delete_own_account()
// removes the auth.users row (cascading to profile, posts, comments, etc.),
// then the local session is cleared so the UI reacts immediately.
export async function deleteOwnAccount(userId: string): Promise<void> {
  await Promise.all(
    STORAGE_BUCKETS.map(async (bucket) => {
      const { data } = await supabase.storage.from(bucket).list(userId);
      const paths = (data ?? []).map((f) => `${userId}/${f.name}`);
      if (paths.length) await supabase.storage.from(bucket).remove(paths);
    })
  );

  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;

  await supabase.auth.signOut({ scope: 'local' });
}
