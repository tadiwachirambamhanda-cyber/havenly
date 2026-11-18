import { formatAedAmount } from './rentSplit';

// "2026-09-01" -> "September 2026" (same wording as the enquiry form).
function monthName(isoDate: string): string {
  const [y, m] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// What a student is looking for. Saved once on the profile so an enquiry can start pre-filled.
export type HousematePref = 'any' | 'female_only' | 'male_only';

export const HOUSEMATE_PREF_OPTIONS: { key: HousematePref; label: string }[] = [
  { key: 'any', label: 'Anyone' },
  { key: 'female_only', label: 'Women only' },
  { key: 'male_only', label: 'Men only' },
];

export const MAX_BUDGET_AED = 100000;

// The budget field is free text. Empty means "no budget set"; anything else must be a whole number of
// AED from 1 to 100,000 (the same limits the database enforces).
export function parseBudget(text: string): { value: number | null; error: string | null } {
  const clean = text.replace(/[,\s]/g, '').replace(/^AED/i, '');
  if (clean === '') return { value: null, error: null };
  if (!/^\d+$/.test(clean)) return { value: null, error: 'Enter the budget as a whole number of AED, for example 3000.' };
  const n = Number(clean);
  if (n < 1 || n > MAX_BUDGET_AED) return { value: null, error: `The budget must be between AED 1 and ${formatAedAmount(MAX_BUDGET_AED)} a month.` };
  return { value: n, error: null };
}

export interface PrefsInput {
  budget_aed?: number | null;
  move_in_month?: string | null;
  housemate_pref?: HousematePref | null;
}

export function hasPreferences(p: PrefsInput): boolean {
  return p.budget_aed != null || !!p.move_in_month || (!!p.housemate_pref && p.housemate_pref !== 'any');
}

// "Up to AED 3,000 a month · from September 2026 · women only"; null when nothing is set.
export function preferenceSummary(p: PrefsInput): string | null {
  if (!hasPreferences(p)) return null;
  const parts: string[] = [];
  if (p.budget_aed != null) parts.push(`Up to ${formatAedAmount(p.budget_aed)} a month`);
  if (p.move_in_month) parts.push(`from ${monthName(p.move_in_month)}`);
  if (p.housemate_pref === 'female_only') parts.push('women only');
  else if (p.housemate_pref === 'male_only') parts.push('men only');
  return parts.join(' · ');
}

// A saved move-in month that has already passed is not offered again: the enquiry form only lists upcoming months.
export function usableMoveIn(saved: string | null | undefined, upcoming: readonly string[]): string | null {
  return saved && upcoming.includes(saved) ? saved : null;
}
