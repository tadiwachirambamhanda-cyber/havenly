import { useCallback, useEffect, useState } from 'react';
import { HOUSING_NOTIFICATION_TYPES } from '@/lib/notificationTypes';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

// Whether the current user has any unread notification, kept live via
// Realtime so the bell's dot doesn't need a screen focus/remount to update.
export function useUnreadNotifications(): boolean {
  const { session } = useAuth();
  const myId = session?.user.id;
  const [hasUnread, setHasUnread] = useState(false);

  // Returns the answer instead of setting state itself, so the effect below
  // is the only place state changes (inside the promise callback).
  const fetchHasUnread = useCallback(async (): Promise<boolean> => {
    if (!myId) return false;
    const { count } = await supabase.from('notifications')
      .select('*', { count: 'exact', head: true }).eq('recipient_id', myId).eq('is_read', false)
      // Housing updates only; older social notifications are archived (tag archive/social-v1).
      .in('type', [...HOUSING_NOTIFICATION_TYPES]);
    return !!count && count > 0;
  }, [myId]);

  useEffect(() => {
    if (!myId) return;
    let active = true;
    const refresh = () => { fetchHasUnread().then((value) => { if (active) setHasUnread(value); }); };
    refresh();
    const channel = supabase.channel('unread-notifications-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${myId}` }, refresh)
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [myId, fetchHasUnread]);

  // Signed out means nothing unread, whatever the last signed-in value was.
  return myId ? hasUnread : false;
}
