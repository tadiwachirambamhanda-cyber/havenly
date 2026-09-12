import { supabase } from '@/lib/supabase';

// Finds the existing 1-1 conversation between two users, or starts a new
// (pending) one. Reused if a conversation already exists regardless of its
// status — including 'declined' — so retrying doesn't spawn a duplicate
// thread; a declined one just stays non-writable per RLS.
export async function findOrCreateConversation(myId: string, otherId: string): Promise<string> {
  const { data: existing } = await supabase.from('conversations').select('id')
    .contains('participant_ids', [myId, otherId]).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase.from('conversations')
    .insert({ participant_ids: [myId, otherId], initiator_id: myId, status: 'pending' })
    .select('id').single();
  if (error) throw error;
  return created.id;
}

// Marks a conversation as read up to now for one user — call this whenever
// they're actively looking at it (on open, and whenever a new message
// arrives while they have it open) or just sent into it themselves.
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  await supabase.from('conversation_reads')
    .upsert({ conversation_id: conversationId, user_id: userId, last_read_at: new Date().toISOString() });
}
