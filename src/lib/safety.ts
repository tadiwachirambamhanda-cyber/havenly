import { supabase } from '@/lib/supabase';

export type ReportTargetType = 'post' | 'user' | 'message' | 'community';

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from('blocked_users').insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
  // Blocking implies unfollowing each other — a block that leaves a stale
  // follow relationship in place would be a confusing half-measure. RPC
  // because "Users can unfollow" only lets you delete rows where you're the
  // follower, so a plain delete can't remove the other direction (them
  // following you).
  await supabase.rpc('unfollow_both_directions', { user_a: blockerId, user_b: blockedId });
}

export async function submitReport(
  reporterId: string,
  targetType: ReportTargetType,
  targetId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase.from('reports').insert({ reporter_id: reporterId, target_type: targetType, target_id: targetId, reason });
  if (error) throw error;
}
