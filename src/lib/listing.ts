import type { CommuteMode, ListingType, ResidenceCommute, StudentDealType } from '@/types';

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

// `field` names the box the form should mark, so the message and the red edge
// land in the same place.
export type ListingField =
  | 'bedrooms' | 'deposit' | 'moveInFee' | 'permit'
  | 'bills' | 'billsMin' | 'billsMax'
  | 'dealTypes' | 'studentRate' | 'housemates' | 'commutes';
export type Failure = { ok: false; error: string; field?: ListingField };
export type Checked<T> = { ok: true; value: T } | Failure;

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

export type ListingFieldsResult = Checked<ListingFields>;

// Whole AED only: plain digits ("1000") or properly grouped thousands
// ("1,000" or "12,500"). Decimals, minus signs, letters, spaces and badly
// placed commas ("1,,0", "1,00") are refused, so a typo can't turn into a
// different amount.
const AMOUNT_PATTERN = /^(\d+|\d{1,3}(,\d{3})+)$/;

function parseAmount(raw: string, label: string, field?: ListingField): Checked<number | null> {
  const text = raw.trim();
  if (!text) return { ok: true, value: null };
  if (!AMOUNT_PATTERN.test(text)) return { ok: false, error: `${label} must be a whole amount in AED, like 1000 or 1,000.`, field };
  const value = Number(text.replace(/,/g, ''));
  if (!Number.isInteger(value)) return { ok: false, error: `${label} must be a whole amount in AED, like 1000.`, field };
  if (value > MAX_EXTRA_COST_AED) return { ok: false, error: `${label} of ${value.toLocaleString('en-US')} AED looks like a typo.`, field };
  return { ok: true, value };
}

// Checks and cleans the new listing fields from the admin form. Only a whole
// home has bedrooms (1 to 3); for every other kind the count is dropped.
export function checkListingFields(input: ListingFieldsInput): ListingFieldsResult {
  let bedrooms: number | null = null;
  if (input.type === 'home') {
    if (input.bedrooms == null || !Number.isInteger(input.bedrooms) || input.bedrooms < 1 || input.bedrooms > 3) {
      return { ok: false, error: 'Pick how many bedrooms the home has (1 to 3).', field: 'bedrooms' };
    }
    bedrooms = input.bedrooms;
  }
  const deposit = parseAmount(input.deposit, 'The deposit', 'deposit');
  if (!deposit.ok) return deposit;
  const fee = parseAmount(input.moveInFee, 'The one-time fees', 'moveInFee');
  if (!fee.ok) return fee;
  const permit = input.permit.trim();
  if (permit.length > MAX_PERMIT_LENGTH) {
    return { ok: false, error: `The permit number is too long (${MAX_PERMIT_LENGTH} characters at most).`, field: 'permit' };
  }
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

// ---- Bills, student deal, housemates and commute times ----

export const STUDENT_DEAL_OPTIONS: { key: StudentDealType; label: string }[] = [
  { key: 'student_rate', label: 'Student rate' },
  { key: 'deposit_waived', label: 'Deposit waived' },
  { key: 'fees_waived', label: 'Fees waived' },
  { key: 'free_first_month', label: 'Free first month' },
  { key: 'group_discount', label: 'Group discount' },
];

export const COMMUTE_MODES: { key: CommuteMode; label: string }[] = [
  { key: 'bus', label: 'Bus' },
  { key: 'metro', label: 'Metro' },
  { key: 'walk', label: 'Walk' },
  { key: 'taxi', label: 'Taxi' },
  { key: 'shuttle', label: 'Shuttle' },
];

// Above these the number is almost certainly an extra zero.
const MAX_BILLS_AED = 20000;
const MAX_STUDENT_RATE_AED = 50000;
const MAX_HOUSEMATES = 10;
const MAX_COMMUTE_MINUTES = 180;

export interface BillsInput {
  // true = in the rent, false = not, null = not stated yet.
  included: boolean | null;
  min: string;
  max: string;
}
export interface Bills {
  bills_included: boolean | null;
  bills_min_aed: number | null;
  bills_max_aed: number | null;
}

// Bills in the rent: the estimate is dropped. Bills not in the rent: the
// estimate is both numbers or neither, and the top is never below the bottom.
export function checkBills(input: BillsInput): Checked<Bills> {
  if (input.included === true) {
    return { ok: true, value: { bills_included: true, bills_min_aed: null, bills_max_aed: null } };
  }
  const min = parseAmount(input.min, 'The bills estimate (from)', 'billsMin');
  if (!min.ok) return min;
  const max = parseAmount(input.max, 'The bills estimate (up to)', 'billsMax');
  if (!max.ok) return max;
  if (min.value != null && min.value > MAX_BILLS_AED) {
    return { ok: false, error: `Bills of ${min.value.toLocaleString('en-US')} AED a month look like a typo.`, field: 'billsMin' };
  }
  if (max.value != null && max.value > MAX_BILLS_AED) {
    return { ok: false, error: `Bills of ${max.value.toLocaleString('en-US')} AED a month look like a typo.`, field: 'billsMax' };
  }
  if ((min.value == null) !== (max.value == null)) {
    return {
      ok: false,
      error: 'Enter both numbers for the bills estimate (from and up to), or leave both empty.',
      field: min.value == null ? 'billsMin' : 'billsMax',
    };
  }
  if (min.value != null && max.value != null && max.value < min.value) {
    return { ok: false, error: 'The top of the bills estimate can’t be lower than the bottom.', field: 'billsMax' };
  }
  const hasEstimate = min.value != null;
  return {
    ok: true,
    value: { bills_included: hasEstimate ? false : input.included, bills_min_aed: min.value, bills_max_aed: max.value },
  };
}

export interface StudentDealInput { on: boolean; types: StudentDealType[]; rate: string }
export interface StudentDeal { student_deal_types: StudentDealType[]; student_rate_aed: number | null }

// Switch off: no deal and no rate. Switch on: at least one known type; a
// student rate, when given, is a whole amount above 0 and needs the
// "Student rate" type ticked.
export function checkStudentDeal(input: StudentDealInput): Checked<StudentDeal> {
  if (!input.on) return { ok: true, value: { student_deal_types: [], student_rate_aed: null } };
  const allowed = STUDENT_DEAL_OPTIONS.map((o) => o.key);
  const types = allowed.filter((k) => input.types.includes(k));
  if (types.length !== new Set(input.types).size) {
    return { ok: false, error: 'One of the student deal types is not recognised.', field: 'dealTypes' };
  }
  if (types.length === 0) {
    return { ok: false, error: 'Tick at least one student deal, or turn the student deal off.', field: 'dealTypes' };
  }
  const text = input.rate.trim();
  if (!text) return { ok: true, value: { student_deal_types: types, student_rate_aed: null } };
  if (!AMOUNT_PATTERN.test(text)) {
    return { ok: false, error: 'The student rate must be a whole amount in AED a month, like 2500.', field: 'studentRate' };
  }
  const rate = Number(text.replace(/,/g, ''));
  if (rate <= 0) return { ok: false, error: 'The student rate must be more than 0 AED a month.', field: 'studentRate' };
  if (rate > MAX_STUDENT_RATE_AED) {
    return { ok: false, error: `A student rate of ${rate.toLocaleString('en-US')} AED a month looks like a typo.`, field: 'studentRate' };
  }
  if (!types.includes('student_rate')) {
    return { ok: false, error: 'Tick “Student rate” for this amount, or clear the amount.', field: 'studentRate' };
  }
  return { ok: true, value: { student_deal_types: types, student_rate_aed: rate } };
}

// Empty means not known. Otherwise a whole number from 0 to 10.
export function checkHousemates(raw: string): Checked<number | null> {
  const text = raw.trim();
  if (!text) return { ok: true, value: null };
  if (!/^\d+$/.test(text) || Number(text) > MAX_HOUSEMATES) {
    return { ok: false, error: `Housemates must be a whole number from 0 to ${MAX_HOUSEMATES}, or empty if not known.`, field: 'housemates' };
  }
  return { ok: true, value: Number(text) };
}

export interface CommuteInput { university: string; minutes: string; mode: CommuteMode | null }

// Rows with nothing filled in are ignored. Every other row needs a
// university, whole minutes above 0 and one of the five modes; a university
// is listed once.
export function checkCommutes(rows: CommuteInput[]): Checked<ResidenceCommute[]> {
  const out: ResidenceCommute[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const university = row.university.trim();
    const minutesText = row.minutes.trim();
    if (!university && !minutesText && !row.mode) continue;
    if (!university) return { ok: false, error: 'Every commute needs a university.', field: 'commutes' };
    if (!/^\d+$/.test(minutesText) || Number(minutesText) <= 0) {
      return { ok: false, error: `Add the minutes for ${university}, a whole number above 0.`, field: 'commutes' };
    }
    const minutes = Number(minutesText);
    if (minutes > MAX_COMMUTE_MINUTES) {
      return { ok: false, error: `${minutes} minutes to ${university} looks like a typo (${MAX_COMMUTE_MINUTES} at most).`, field: 'commutes' };
    }
    if (!row.mode || !COMMUTE_MODES.some((m) => m.key === row.mode)) {
      return { ok: false, error: `Pick how students get to ${university}: bus, metro, walk, taxi or shuttle.`, field: 'commutes' };
    }
    const key = university.toLowerCase();
    if (seen.has(key)) return { ok: false, error: `${university} is listed twice. Keep one commute per university.`, field: 'commutes' };
    seen.add(key);
    out.push({ university, minutes, mode: row.mode });
  }
  return { ok: true, value: out };
}
