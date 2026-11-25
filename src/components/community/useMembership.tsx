import { useCallback, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { friendlyError, joinProblem } from '@/lib/community';
import { fetchMyCommunityIds, joinCommunity, leaveCommunity } from '@/lib/communityApi';
import type { Community } from '@/types';

// Which communities I am in, with join (20 at most) and leave.
export function useMembership(onChange?: () => void) {
  const { session } = useAuth();
  const myId = session?.user.id;
  const { showToast } = useToast();
  const [joinedIds, setJoinedIds] = useState<Set<string> | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<Set<string>> => {
    const ids = new Set(myId ? await fetchMyCommunityIds(myId) : []);
    setJoinedIds(ids);
    return ids;
  }, [myId]);

  const join = useCallback(async (c: Community) => {
    if (!myId || !joinedIds || joinedIds.has(c.id)) return;
    const problem = joinProblem(joinedIds.size);
    if (problem) { showToast(problem, 'error'); return; }
    setJoiningId(c.id);
    haptics.tap();
    try {
      await joinCommunity(myId, c.id);
      setJoinedIds((prev) => new Set(prev ?? []).add(c.id));
      showToast(`Joined ${c.name}.`);
      onChange?.();
    } catch (e) {
      showToast(friendlyError(e, 'Couldn’t join. Try again.'), 'error');
    } finally {
      setJoiningId(null);
    }
  }, [myId, joinedIds, showToast, onChange]);

  const leave = useCallback(async (c: Community) => {
    if (!myId) return;
    setJoiningId(c.id);
    try {
      await leaveCommunity(myId, c.id);
      setJoinedIds((prev) => { const n = new Set(prev ?? []); n.delete(c.id); return n; });
      showToast(`You left ${c.name}.`);
      onChange?.();
    } catch (e) {
      showToast(friendlyError(e, 'Couldn’t leave. Try again.'), 'error');
    } finally {
      setJoiningId(null);
    }
  }, [myId, showToast, onChange]);

  return { joinedIds, joiningId, join, leave, load };
}
