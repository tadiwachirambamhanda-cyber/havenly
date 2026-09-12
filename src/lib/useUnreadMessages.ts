import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';

// Whether the current user has any unread conversation, kept live via
// Realtime so the nav bar's dot doesn't need a screen focus/remount to update.
export function useUnreadMessages(): boolean {
  const { session } = useAuth();
  const myId = session?.user.id;
  const [hasUnread, setHasUnread] = useState(false);

  const check = useCallback(async () => {
    if (!myId) { setHasUnread(false); return; }
    const [{ data: conversations }, { data: reads }] = await Promise.all([
      supabase.from('conversations').select('id, last_message_at')
        .contains('participant_ids', [myId]).neq('status', 'declined'),
      supabase.from('conversation_reads').select('conversation_id, last_read_at').eq('user_id', myId),
    ]);
    if (!conversations) { setHasUnread(false); return; }
    const readAtByConversation = new Map((reads ?? []).map((r) => [r.conversation_id, r.last_read_at]));
    setHasUnread(conversations.some((c) => {
      if (!c.last_message_at) return false;
      const readAt = readAtByConversation.get(c.id);
      return !readAt || new Date(readAt) < new Date(c.last_message_at);
    }));
  }, [myId]);

  useEffect(() => {
    check();
    if (!myId) return;
    const channel = supabase.channel('unread-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => check())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () => check())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_reads', filter: `user_id=eq.${myId}` }, () => check())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myId, check]);

  return hasUnread;
}
