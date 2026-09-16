import { supabase } from '@/lib/supabase';
import type { CheckInPlaceType } from '@/types';

// Wraps toggle_interest() — a security-definer RPC that flips the row
// atomically server-side (auth.uid() identifies the user, not a passed-in
// id), rather than a client-side check-then-insert/delete with a race
// window between two rapid taps. Returns the new state so callers can
// update local UI without a refetch.
export async function toggleInterest(placeType: CheckInPlaceType, placeId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_interest', { place_type_input: placeType, place_id_input: placeId });
  if (error) throw error;
  return !!data?.[0]?.interested;
}
