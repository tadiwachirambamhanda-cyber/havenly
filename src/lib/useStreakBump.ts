import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';

// Celebrates a handful of round-number streaks rather than every single
// day — a toast every time you just open the app would get old fast.
const MILESTONES = [3, 7, 14, 30, 50, 100];
function isMilestone(streak: number): boolean {
  return MILESTONES.includes(streak) || (streak > 100 && streak % 50 === 0);
}

// Extends the signed-in user's daily activity streak once per app session.
// bump_streak() is idempotent per UTC day (see its own comment for why),
// so re-running this — a hot reload, a re-render — is harmless.
export function useStreakBump() {
  const { session, profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const userId = session?.user.id;
  const onboarded = profile?.has_completed_onboarding;

  useEffect(() => {
    if (!userId || !onboarded) return;
    supabase.rpc('bump_streak').then(async ({ data, error }) => {
      if (error || !data?.[0]) return;
      const { current_streak, is_new_day } = data[0];
      if (!is_new_day) return;
      await refreshProfile();
      if (isMilestone(current_streak)) {
        haptics.success();
        showToast(`${current_streak}-day streak`);
      }
    });
    // Deliberately keyed on just these two — refreshProfile/showToast come
    // from context and don't need to retrigger this on their own.
  }, [userId, onboarded]);
}
