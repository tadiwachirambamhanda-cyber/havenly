import { supabase } from '@/lib/supabase';

export type ReportTargetType = 'post' | 'user' | 'message' | 'community';

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from('blocked_users').insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
  // Blocking implies unfollowing each other — a block that leaves a stale
  // follow relationship in place would be a confusing half-measure.
  await supabase.from('follows').delete().eq('follower_id', blockerId).eq('following_id', blockedId);
  await supabase.from('follows').delete().eq('follower_id', blockedId).eq('following_id', blockerId);
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
