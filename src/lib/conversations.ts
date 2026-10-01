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

// Creates a new group — always a fresh conversation, unlike
// findOrCreateConversation, since there's no single "the" group between a
// set of people the way there's exactly one 1:1 thread between two. Starts
// 'accepted' immediately: a group has no request/accept step, you're just
// added, matching most chat apps' group semantics.
export async function createGroupConversation(myId: string, memberIds: string[], name: string | null): Promise<string> {
  const { data: created, error } = await supabase.from('conversations')
    .insert({ participant_ids: [myId, ...memberIds], initiator_id: myId, is_group: true, status: 'accepted', name })
    .select('id').single();
  if (error) throw error;
  return created.id;
}

// Uploads a picked image as a group's icon and points icon_url at it —
// path is "<conversationId>/<timestamp>.<ext>", not a user id, since a
// group icon has no single owner (see the group-icons bucket policies).
export async function uploadGroupIcon(conversationId: string, localUri: string): Promise<string> {
  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${conversationId}/${Date.now()}.${ext}`;
  const arrayBuffer = await fetch(localUri).then((r) => r.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from('group-icons').upload(path, arrayBuffer, {
    contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  });
  if (uploadError) throw uploadError;
  const iconUrl = supabase.storage.from('group-icons').getPublicUrl(path).data.publicUrl;
  const { error: updateError } = await supabase.from('conversations').update({ icon_url: iconUrl }).eq('id', conversationId);
  if (updateError) throw updateError;
  return iconUrl;
}

// Marks a conversation as read up to now for one user — call this whenever
// they're actively looking at it (on open, and whenever a new message
// arrives while they have it open) or just sent into it themselves.
export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  await supabase.from('conversation_reads')
    .upsert({ conversation_id: conversationId, user_id: userId, last_read_at: new Date().toISOString() });
}

// Removes a conversation from just this user's Inbox — the other
// participant(s) still see it and it's never deleted outright. A new
// message reactivates it: InboxScreen only hides a conversation whose
// hidden_at is at or after its last activity, so this timestamp is what
// makes that comparison work, not a boolean.
export async function hideConversation(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('conversation_hidden_for')
    .upsert({ conversation_id: conversationId, user_id: userId, hidden_at: new Date().toISOString() });
  if (error) throw error;
}
