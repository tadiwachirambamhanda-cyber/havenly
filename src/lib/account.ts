import { supabase } from '@/lib/supabase';

// Every bucket where a user's own uploads live under "<userId>/". Group
// icons and residence photos aren't here on purpose: they belong to a group
// or a residence, not to one person.
const STORAGE_BUCKETS = ['avatars', 'covers', 'post-images', 'post-videos'];
const PAGE_SIZE = 1000;

const FILES_FAILED = 'We couldn’t remove your photos and videos, so your account has not been deleted. Check your connection and try again.';

async function removeUserFiles(bucket: string, userId: string): Promise<void> {
  // list() returns at most PAGE_SIZE entries, so keep removing until the
  // folder comes back empty rather than stopping after the first page. Any
  // failure is thrown (not swallowed): deleting the account while its files
  // are still in public storage would leave them there for good.
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(userId, { limit: PAGE_SIZE });
    if (error) throw new Error(FILES_FAILED);
    if (!data?.length) return;
    const paths = data.map((f) => `${userId}/${f.name}`);
    const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
    if (removeError) throw new Error(FILES_FAILED);
    if (data.length < PAGE_SIZE) return;
  }
}

// Permanently deletes the signed-in user's account. Storage files aren't
// covered by the database's cascading deletes, so they're removed first,
// while the session can still write to storage. If that fails for any
// reason the account is left alone and the error is shown, so nothing is
// half-deleted without the person knowing. Then delete_own_account() clears
// their chat traces and removes the auth.users row (cascading to profile,
// posts, comments, etc.), and the local session is cleared so the UI reacts
// immediately.
export async function deleteOwnAccount(userId: string): Promise<void> {
  const results = await Promise.allSettled(STORAGE_BUCKETS.map((bucket) => removeUserFiles(bucket, userId)));
  if (results.some((r) => r.status === 'rejected')) throw new Error(FILES_FAILED);

  const { error } = await supabase.rpc('delete_own_account');
  if (error) {
    throw new Error('Your photos and videos were removed, but we couldn’t finish deleting your account. Try again to complete it.');
  }

  await supabase.auth.signOut({ scope: 'local' });
}
