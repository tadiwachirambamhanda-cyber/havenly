// Shared, pure calculations for splitting a whole home between students and for the
// move-in total. No imports from React Native, so they run in the unit tests. The
// numbers match design/handoff (AED 9,000, 3 people, bills AED 450 to 700).

export type BillsInput =
  | { kind: 'included' }
  | { kind: 'range'; minAed: number; maxAed: number }
  | { kind: 'unknown' };

export interface SplitInput {
  // Monthly rent for the whole home, whole AED.
  rentAed: number;
  depositAed?: number | null;
  feesAed?: number | null;
  bills: BillsInput;
  people: number;
}

export interface RentSplit {
  people: number;
  rentEach: number;
  bills:
    | { kind: 'included' }
    | { kind: 'unknown' }
    | { kind: 'range'; minEach: number; maxEach: number };
  // What one person pays a month, rent plus bills. Equal when there is no range.
  monthlyEachMin: number;
  monthlyEachMax: number;
  isRange: boolean;
  depositEach: number | null;
  // True when the share does not divide evenly and was rounded to the nearest AED.
  depositEachApprox: boolean;
  feesEach: number | null;
  feesEachApprox: boolean;
}

export const MIN_PEOPLE = 1;
export const MAX_PEOPLE = 10;

const isWholeAed = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

// A student shares with others: the usual number is one per bedroom.
export function defaultPeople(bedrooms: number | null | undefined): number {
  if (bedrooms == null || !Number.isInteger(bedrooms)) return 2;
  return Math.min(MAX_PEOPLE, Math.max(MIN_PEOPLE, bedrooms));
}

// Returns null when the inputs cannot be split (no valid rent, bad people count, or a
// bills range that is upside down). The screen shows "We cannot split this one yet".
export function splitRent(input: SplitInput): RentSplit | null {
  const { rentAed, depositAed, feesAed, bills, people } = input;
  if (!Number.isInteger(people) || people < MIN_PEOPLE || people > MAX_PEOPLE) return null;
  if (!isWholeAed(rentAed) || rentAed <= 0) return null;
  if (depositAed != null && !isWholeAed(depositAed)) return null;
  if (feesAed != null && !isWholeAed(feesAed)) return null;

  let billsMin = 0;
  let billsMax = 0;
  let billsOut: RentSplit['bills'] = { kind: 'unknown' };
  if (bills.kind === 'included') {
    billsOut = { kind: 'included' };
  } else if (bills.kind === 'range') {
    if (!isWholeAed(bills.minAed) || !isWholeAed(bills.maxAed) || bills.maxAed < bills.minAed) return null;
    billsMin = bills.minAed;
    billsMax = bills.maxAed;
    billsOut = { kind: 'range', minEach: Math.round(billsMin / people), maxEach: Math.round(billsMax / people) };
  }

  // Round the total share, not each part, so the figures shown add up to what the student pays.
  const monthlyEachMin = Math.round((rentAed + billsMin) / people);
  const monthlyEachMax = Math.round((rentAed + billsMax) / people);
  const share = (amount: number | null | undefined) =>
    amount == null ? { each: null, approx: false } : { each: Math.round(amount / people), approx: amount % people !== 0 };
  const deposit = share(depositAed);
  const fees = share(feesAed);

  return {
    people,
    rentEach: Math.round(rentAed / people),
    bills: billsOut,
    monthlyEachMin,
    monthlyEachMax,
    isRange: monthlyEachMin !== monthlyEachMax,
    depositEach: deposit.each,
    depositEachApprox: deposit.approx,
    feesEach: fees.each,
    feesEachApprox: fees.approx,
  };
}

// First month's rent plus deposit plus one-time fees. Missing amounts count as none.
export function moveInTotal(parts: { firstMonthAed: number; depositAed?: number | null; feesAed?: number | null }): number {
  return parts.firstMonthAed + (parts.depositAed ?? 0) + (parts.feesAed ?? 0);
}

const group = (n: number) => Math.round(n).toLocaleString('en-US');

export function formatAedAmount(amount: number): string {
  return `AED ${group(amount)}`;
}

// "AED 3,150 to 3,233", or "AED 3,000" when the two ends are the same.
export function formatAedRange(min: number, max: number): string {
  return min === max ? formatAedAmount(min) : `AED ${group(min)} to ${group(max)}`;
}
