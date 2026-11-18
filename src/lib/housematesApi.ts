import { supabase } from '@/lib/supabase';
import type { BoardCard, CardInput, MyCard } from './housemates';

// Database calls for the housemate board. The rules about who sees whom live in the database function
// housemate_board; the pure checks and wording are in housemates.ts.

export interface BoardFilters {
  university?: string | null;
  maxBudget?: number | null;
  moveIn?: string | null;
  area?: string | null;
  residenceId?: string | null;
}

export async function fetchBoard(f: BoardFilters): Promise<BoardCard[]> {
  const { data, error } = await supabase.rpc('housemate_board', {
    p_university: f.university ?? null,
    p_max_budget: f.maxBudget ?? null,
    p_move_in: f.moveIn ?? null,
    p_area: f.area?.trim() || null,
    p_residence: f.residenceId ?? null,
  });
  if (error) throw error;
  return (data as BoardCard[]) ?? [];
}

export async function countForHome(residenceId: string): Promise<number> {
  const { data, error } = await supabase.rpc('housemates_for_home', { p_residence: residenceId });
  if (error) return 0;
  return typeof data === 'number' ? data : 0;
}

export async function fetchMyCard(userId: string): Promise<MyCard | null> {
  const { data, error } = await supabase.from('housemate_cards').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return (data as MyCard | null) ?? null;
}

export async function saveMyCard(userId: string, input: CardInput, active: boolean): Promise<void> {
  const { error } = await supabase.from('housemate_cards').upsert({
    user_id: userId,
    active,
    area: input.area.trim(),
    lifestyle: [...input.lifestyle],
    note: input.note.trim() || null,
    residence_id: input.residenceId,
    spots_needed: input.residenceId ? input.spots : null,
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function deleteMyCard(userId: string): Promise<void> {
  const { error } = await supabase.from('housemate_cards').delete().eq('user_id', userId);
  if (error) throw error;
}

export async function reviewCard(userId: string, status: 'approved' | 'hidden', note?: string): Promise<void> {
  const { error } = await supabase.rpc('review_housemate_card', { p_user: userId, p_status: status, p_note: note ?? null });
  if (error) throw error;
}
