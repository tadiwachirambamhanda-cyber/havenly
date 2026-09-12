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
