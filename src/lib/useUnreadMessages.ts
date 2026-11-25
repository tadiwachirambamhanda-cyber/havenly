import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

// Whether the current user has any unread conversation, kept live via
// Realtime so the nav bar's dot doesn't need a screen focus/remount to update.
export function useUnreadMessages(): boolean {
  const { session } = useAuth();
  const myId = session?.user.id;
  const [hasUnread, setHasUnread] = useState(false);
  // Several places show this dot (the tab bar and Profile). A live channel's name must be unique per listener:
  // two with the same name share one channel, and adding a listener to an already-subscribed channel throws
  // (the Profile render error, same cause as in useUnreadNotifications).
  const instanceId = useId();

  // Returns the answer instead of setting state itself, so the effect below
  // is the only place state changes (inside the promise callback).
  const fetchHasUnread = useCallback(async (): Promise<boolean> => {
    if (!myId) return false;
    const [{ data: conversations }, { data: reads }] = await Promise.all([
      supabase.from('conversations').select('id, last_message_at')
        .contains('participant_ids', [myId]).neq('status', 'declined'),
      supabase.from('conversation_reads').select('conversation_id, last_read_at').eq('user_id', myId),
    ]);
    if (!conversations) return false;
    const readAtByConversation = new Map((reads ?? []).map((r) => [r.conversation_id, r.last_read_at]));
    return conversations.some((c) => {
      if (!c.last_message_at) return false;
      const readAt = readAtByConversation.get(c.id);
      return !readAt || new Date(readAt) < new Date(c.last_message_at);
    });
  }, [myId]);

  useEffect(() => {
    if (!myId) return;
    let active = true;
    const refresh = () => { fetchHasUnread().then((value) => { if (active) setHasUnread(value); }); };
    refresh();
    const channel = supabase.channel(`unread-messages-badge-${instanceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_reads', filter: `user_id=eq.${myId}` }, refresh)
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [myId, fetchHasUnread, instanceId]);

  // Signed out means nothing unread, whatever the last signed-in value was.
  return myId ? hasUnread : false;
}
