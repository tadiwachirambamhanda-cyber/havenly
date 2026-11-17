import type { ListingType } from '@/types';

export const LISTING_TYPES: { key: ListingType; label: string }[] = [
  { key: 'residence', label: 'Student residence' },
  { key: 'shared_room', label: 'Room in a shared apartment' },
  { key: 'private_room', label: 'Private room' },
  { key: 'studio', label: 'Studio' },
  { key: 'home', label: 'Whole home' },
];

export const LISTING_TYPE_LABEL: Record<ListingType, string> = {
  residence: 'Student residence',
  shared_room: 'Room in a shared apartment',
  private_room: 'Private room',
  studio: 'Studio',
  home: 'Whole home',
};

export const BEDROOM_OPTIONS = [1, 2, 3];

// A deposit or fee above this is almost certainly a typo (an extra zero).
const MAX_EXTRA_COST_AED = 100000;
const MAX_PERMIT_LENGTH = 40;

export interface ListingFieldsInput {
  type: ListingType;
  bedrooms: number | null;
  deposit: string;
  moveInFee: string;
  permit: string;
}

export interface ListingFields {
  listing_type: ListingType;
  bedrooms: number | null;
  deposit_aed: number | null;
  move_in_fee_aed: number | null;
  permit_number: string | null;
}

export type ListingFieldsResult = { ok: true; value: ListingFields } | { ok: false; error: string };

// Whole AED only. Commas and spaces are fine ("1,000"); a decimal point,
// a minus sign or letters are not, so "1,000.50" can't turn into 100050.
function parseAmount(raw: string, label: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: true, value: null };
  if (!/^[\d,\s]+$/.test(text)) return { ok: false, error: `${label} must be a whole amount in AED, like 1000.` };
  const value = Number(text.replace(/[,\s]/g, ''));
  if (!Number.isInteger(value)) return { ok: false, error: `${label} must be a whole amount in AED, like 1000.` };
  if (value > MAX_EXTRA_COST_AED) return { ok: false, error: `${label} of ${value.toLocaleString('en-US')} AED looks like a typo.` };
  return { ok: true, value };
}

// Checks and cleans the new listing fields from the admin form. Only a whole
// home has bedrooms (1 to 3); for every other kind the count is dropped.
export function checkListingFields(input: ListingFieldsInput): ListingFieldsResult {
  let bedrooms: number | null = null;
  if (input.type === 'home') {
    if (input.bedrooms == null || !Number.isInteger(input.bedrooms) || input.bedrooms < 1 || input.bedrooms > 3) {
      return { ok: false, error: 'Pick how many bedrooms the home has (1 to 3).' };
    }
    bedrooms = input.bedrooms;
  }
  const deposit = parseAmount(input.deposit, 'The deposit');
  if (!deposit.ok) return deposit;
  const fee = parseAmount(input.moveInFee, 'The one-time fees');
  if (!fee.ok) return fee;
  const permit = input.permit.trim();
  if (permit.length > MAX_PERMIT_LENGTH) return { ok: false, error: `The permit number is too long (${MAX_PERMIT_LENGTH} characters at most).` };
  return {
    ok: true,
    value: {
      listing_type: input.type,
      bedrooms,
      deposit_aed: deposit.value,
      move_in_fee_aed: fee.value,
      permit_number: permit || null,
    },
  };
}
