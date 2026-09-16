import { supabase } from '@/lib/supabase';
import type { CheckInPlaceType } from '@/types';

// Toggles "I'm down to go" for one place — a plain flip since, unlike a
// check-in, there's nothing on the row itself that ever needs refreshing.
// Returns the new state so callers can update local UI without a refetch.
export async function toggleInterest(userId: string, placeType: CheckInPlaceType, placeId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('interests')
    .select('id')
    .eq('user_id', userId)
    .eq('place_type', placeType)
    .eq('place_id', placeId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('interests').delete().eq('id', existing.id);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from('interests').insert({ user_id: userId, place_type: placeType, place_id: placeId });
  if (error) throw error;
  return true;
}
