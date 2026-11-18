import { formatAedAmount } from './rentSplit';

// Housemates: students who want to live together find each other. Who can see whose card is decided in the
// database (housemate_board), never here: a card is shown only if each side's "who I would live with" choice
// accepts the other's gender. Everything in this file is about shaping, checking and fetching cards.

export type LifestyleKey =
  | 'early_riser' | 'night_owl' | 'studies_at_home' | 'studies_out' | 'non_smoker'
  | 'smoker_ok' | 'quiet' | 'social' | 'guests_ok' | 'few_guests';

export const LIFESTYLE_OPTIONS: { key: LifestyleKey; label: string }[] = [
  { key: 'early_riser', label: 'Early riser' },
  { key: 'night_owl', label: 'Night owl' },
  { key: 'studies_at_home', label: 'Studies at home' },
  { key: 'studies_out', label: 'Studies out' },
  { key: 'non_smoker', label: 'Non-smoker' },
  { key: 'smoker_ok', label: 'Fine with smoking' },
  { key: 'quiet', label: 'Quiet' },
  { key: 'social', label: 'Social' },
  { key: 'guests_ok', label: 'Guests are fine' },
  { key: 'few_guests', label: 'Few guests' },
];
export const LIFESTYLE_LABEL: Record<LifestyleKey, string> = Object.fromEntries(
  LIFESTYLE_OPTIONS.map((o) => [o.key, o.label]),
) as Record<LifestyleKey, string>;

export const MAX_TAGS = 5;
export const NOTE_MAX = 280;
export const AREA_MAX = 80;
export const MAX_SPOTS = 5;

// Choices that say the opposite thing are not allowed together on one card.
const OPPOSITES: [LifestyleKey, LifestyleKey][] = [
  ['early_riser', 'night_owl'], ['non_smoker', 'smoker_ok'], ['guests_ok', 'few_guests'], ['quiet', 'social'],
];

export type Gender = 'female' | 'male';
export type HousematePref = 'any' | 'female_only' | 'male_only';
export type CardStatus = 'pending' | 'approved' | 'hidden';

export interface MyCard {
  user_id: string;
  status: CardStatus;
  review_note: string | null;
  active: boolean;
  area: string | null;
  lifestyle: LifestyleKey[];
  note: string | null;
  residence_id: string | null;
  spots_needed: number | null;
}

export interface BoardCard {
  user_id: string; display_name: string; university: string | null; gender: Gender | null;
  budget_aed: number; move_in_month: string; area: string | null; lifestyle: LifestyleKey[]; note: string | null;
  residence_id: string | null; residence_name: string | null; spots_needed: number | null; updated_at: string;
}

export interface CardInput {
  area: string;
  lifestyle: readonly LifestyleKey[];
  note: string;
  residenceId: string | null;
  spots: number | null;
}

// The message a student sees when their card cannot be saved; null when it is fine.
export function cardProblem(input: CardInput): string | null {
  const area = input.area.trim();
  if (!area) return 'Add the area you want to live in, for example Dubai Marina.';
  if (area.length > AREA_MAX) return `Keep the area under ${AREA_MAX} characters.`;
  if (input.lifestyle.length > MAX_TAGS) return `Pick at most ${MAX_TAGS} lifestyle tags.`;
  if (new Set(input.lifestyle).size !== input.lifestyle.length) return 'Each lifestyle tag can only be picked once.';
  for (const [a, b] of OPPOSITES) {
    if (input.lifestyle.includes(a) && input.lifestyle.includes(b)) {
      return `${LIFESTYLE_LABEL[a]} and ${LIFESTYLE_LABEL[b].toLowerCase()} say opposite things. Pick one.`;
    }
  }
  if (input.note.trim().length > NOTE_MAX) return `Keep the note under ${NOTE_MAX} characters.`;
  if (input.residenceId) {
    if (input.spots == null || !Number.isInteger(input.spots) || input.spots < 1 || input.spots > MAX_SPOTS) {
      return `Say how many housemates you need, from 1 to ${MAX_SPOTS}.`;
    }
  }
  return null;
}

// Plain words about who will see the card, so nobody has to guess how the matching works.
export function visibilityExplainer(gender: Gender | null | undefined, pref: HousematePref | null | undefined): string {
  const who = pref === 'female_only' ? 'women' : pref === 'male_only' ? 'men' : null;
  if (!gender) {
    return who
      ? `You prefer to live with ${who}, but you have not said your gender, so nobody will see your card and you will see no one. Add your gender in Edit profile, or choose "Anyone".`
      : 'You have not said your gender, so your card is shown only to students who are happy to live with anyone.';
  }
  const me = gender === 'female' ? 'women' : 'men';
  if (!who) return 'Your card is shown to students who are happy to live with someone like you, whatever their gender.';
  return `Your card is shown only to ${who} who are happy to live with ${me}, and you only see ${who}.`;
}

export function budgetLine(card: Pick<BoardCard, 'budget_aed' | 'move_in_month'>): string {
  const [y, m] = card.move_in_month.split('-').map(Number);
  const month = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return `${formatAedAmount(card.budget_aed)} a month · moving in ${month}`;
}

export function genderLabel(g: Gender | null): string | null {
  return g === 'female' ? 'Woman' : g === 'male' ? 'Man' : null;
}
