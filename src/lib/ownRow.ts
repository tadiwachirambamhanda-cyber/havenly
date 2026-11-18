import { supabase } from '@/lib/supabase';

// Saves the signed-in student's own single row in a table keyed by user_id (their private profile fields,
// their housemate card). It updates the row if there is one and inserts it otherwise.
//
// Not a database "upsert": that also rewrites the user_id column, which students are (rightly) not allowed
// to change, so the database refuses it. Row security keeps each student to their own row either way.
export async function saveOwnRow(
  table: 'profile_private' | 'housemate_cards',
  userId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await supabase.from(table).update(values).eq('user_id', userId).select('user_id');
  if (error) throw error;
  if (data && data.length > 0) return;
  const { error: insertError } = await supabase.from(table).insert({ user_id: userId, ...values });
  if (insertError) throw insertError;
}
