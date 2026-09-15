import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

// Whether the current user has any unread notification, kept live via
// Realtime so the bell's dot doesn't need a screen focus/remount to update.
export function useUnreadNotifications(): boolean {
  const { session } = useAuth();
  const myId = session?.user.id;
  const [hasUnread, setHasUnread] = useState(false);

  const check = useCallback(async () => {
    if (!myId) { setHasUnread(false); return; }
    const { count } = await supabase.from('notifications')
      .select('*', { count: 'exact', head: true }).eq('recipient_id', myId).eq('is_read', false);
    setHasUnread(!!count && count > 0);
  }, [myId]);

  useEffect(() => {
    check();
    if (!myId) return;
    const channel = supabase.channel('unread-notifications-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${myId}` }, () => check())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myId, check]);

  return hasUnread;
}
