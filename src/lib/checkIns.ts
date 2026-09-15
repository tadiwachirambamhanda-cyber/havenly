import { supabase } from '@/lib/supabase';
import type { CheckInPlaceType } from '@/types';

// One active check-in per place per user — checking in again replaces the
// old row (delete + insert, since check_ins has no update policy — there's
// nothing else to ever update on one) rather than leaving two rows for the
// same visit.
export async function createCheckIn(userId: string, placeType: CheckInPlaceType, placeId: string): Promise<void> {
  await supabase.from('check_ins').delete().eq('user_id', userId).eq('place_type', placeType).eq('place_id', placeId);
  const { error } = await supabase.from('check_ins').insert({ user_id: userId, place_type: placeType, place_id: placeId });
  if (error) throw error;
}

export async function deleteCheckIn(checkInId: string): Promise<void> {
  const { error } = await supabase.from('check_ins').delete().eq('id', checkInId);
  if (error) throw error;
}

// Wraps send_ping() — the RPC re-verifies eligibility server-side, this
// just surfaces its error message to the caller.
export async function sendPing(checkInId: string): Promise<void> {
  const { error } = await supabase.rpc('send_ping', { check_in_id_input: checkInId });
  if (error) throw error;
}
