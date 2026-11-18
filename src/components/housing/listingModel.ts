// Pure helpers the housing screens share: prices, bills lines, the per-person range, move-in
// rows, filters and sorting. No React Native imports, so they run in the unit tests.
import type { BillingPeriod, GenderPolicy, ListingType, Residence, ResidenceCommute, RoomType } from '../../types';
import { defaultPeople, formatAedRange, moveInTotal, splitRent, type BillsInput } from '../../lib/rentSplit';
import { effectiveMonthlyAed, hasStudentDeal, isStudentFriendly, sortForSearch, type RankInput } from '../../lib/ranking';

export type SortChoice = 'recommended' | 'price_low' | 'price_high' | 'newest';

export const SORT_LABEL: Record<SortChoice, string> = {
  recommended: 'Recommended',
  price_low: 'Lowest price first',
  price_high: 'Highest price first',
  newest: 'Newest first',
};

export const PRICE_CAPS = [2500, 3000, 4000];

export function monthlyEquivalent(room: Pick<RoomType, 'price_aed' | 'billing_period'>): number {
  const perPeriod: Record<BillingPeriod, number> = { month: 1, semester: 6, year: 12 };
  return Math.round(room.price_aed / perPeriod[room.billing_period]);
}

// The listing price a month: the cheapest room that is still available, as a monthly figure.
export function monthlyAedOf(r: Pick<Residence, 'room_types'>): number | null {
  const prices = (r.room_types ?? []).filter((x) => x.is_available && x.price_aed > 0).map(monthlyEquivalent);
  return prices.length ? Math.min(...prices) : null;
}

export function toRankInput(r: Residence): RankInput {
  return {
    id: r.id,
    monthlyAed: monthlyAedOf(r),
    verified: r.is_verified,
    billsIncluded: r.bills_included,
    studentDealTypes: r.student_deal_types ?? [],
    studentRateAed: r.student_rate_aed,
  };
}

export const isDeal = (r: Residence) => hasStudentDeal(toRankInput(r));
export const isFriendly = (r: Residence) => isStudentFriendly(toRankInput(r));

// What to show as the price: with a student rate below the normal price, "now" is the rate and
// "was" the normal price (struck through).
export function priceInfo(r: Residence): { now: number | null; was: number | null } {
  const normal = monthlyAedOf(r);
  const now = effectiveMonthlyAed(normal, r.student_rate_aed);
  const was = now != null && normal != null && now < normal ? normal : null;
  return { now, was };
}

export const isWholeHome = (r: Pick<Residence, 'listing_type'>) => r.listing_type === 'home';

export function billsInputOf(r: Residence): BillsInput {
  if (r.bills_included === true) return { kind: 'included' };
  if (r.bills_included === false && r.bills_min_aed != null && r.bills_max_aed != null) {
    return { kind: 'range', minAed: r.bills_min_aed, maxAed: r.bills_max_aed };
  }
  return { kind: 'unknown' };
}

// One short line for a card or the cost box.
export function billsLine(r: Residence): string {
  const home = isWholeHome(r) ? ' for the home' : '';
  if (r.bills_included === true) return 'Bills included';
  if (r.bills_included === false) {
    if (r.bills_min_aed != null && r.bills_max_aed != null) {
      return `Bills not included, about ${formatAedRange(r.bills_min_aed, r.bills_max_aed)} a month${home}`;
    }
    return 'Bills not included';
  }
  return 'Bills not confirmed yet';
}

// "About AED 3,150 to 3,233 each for 3 people", for whole homes with a price.
export function eachPersonLine(r: Residence): string | null {
  if (!isWholeHome(r)) return null;
  const rent = priceInfo(r).now;
  if (rent == null) return null;
  const people = defaultPeople(r.bedrooms);
  const s = splitRent({ rentAed: rent, bills: billsInputOf(r), people });
  if (!s) return null;
  return `About ${formatAedRange(s.monthlyEachMin, s.monthlyEachMax)} each for ${people} people`;
}

export interface MoveInRows {
  firstMonth: number;
  deposit: number | null;
  fees: number | null;
  total: number;
}

export function moveInRows(r: Residence): MoveInRows | null {
  const first = priceInfo(r).now;
  if (first == null) return null;
  const total = moveInTotal({ firstMonthAed: first, depositAed: r.deposit_aed, feesAed: r.move_in_fee_aed });
  if (total == null) return null;
  return { firstMonth: first, deposit: r.deposit_aed, fees: r.move_in_fee_aed, total };
}

export const MODE_LABEL: Record<ResidenceCommute['mode'], string> = {
  bus: 'by bus', metro: 'by metro', walk: 'on foot', taxi: 'by taxi', shuttle: 'by shuttle',
};

export const commuteText = (c: ResidenceCommute) => `${c.minutes} min ${MODE_LABEL[c.mode]}`;

// The commute to show on a card: the student's own university when listed, else the shortest.
export function pickCommute(r: Pick<Residence, 'commutes'>, university: string | null): ResidenceCommute | null {
  const list = r.commutes ?? [];
  if (!list.length) return null;
  const mine = university ? list.find((c) => c.university === university) : undefined;
  return mine ?? [...list].sort((a, b) => a.minutes - b.minutes)[0];
}

export function housematesLine(n: number | null): string | null {
  if (n == null) return null;
  if (n === 0) return 'No housemates';
  return n === 1 ? '1 housemate' : `${n} housemates`;
}

export interface Filters {
  verified: boolean;
  maxMonthly: number | null;
  billsIncluded: boolean;
  kind: ListingType | null;
  bedrooms: 1 | 2 | 3 | null;
  studentDeal: boolean;
  gender: GenderPolicy | null;
  query: string;
}

export const EMPTY_FILTERS: Filters = {
  verified: false, maxMonthly: null, billsIncluded: false, kind: null, bedrooms: null, studentDeal: false, gender: null, query: '',
};

export const filtersActive = (f: Filters) =>
  f.verified || f.maxMonthly != null || f.billsIncluded || f.kind != null || f.bedrooms != null || f.studentDeal || f.gender != null || f.query.trim() !== '';

export function matchesFilters(r: Residence, f: Filters): boolean {
  if (f.verified && !r.is_verified) return false;
  if (f.billsIncluded && r.bills_included !== true) return false;
  if (f.studentDeal && !isDeal(r)) return false;
  if (f.kind && r.listing_type !== f.kind) return false;
  if (f.bedrooms != null && !(r.listing_type === 'home' && r.bedrooms === f.bedrooms)) return false;
  if (f.gender && r.gender_policy !== f.gender) return false;
  if (f.maxMonthly != null) {
    const price = priceInfo(r).now;
    if (price == null || price > f.maxMonthly) return false;
  }
  const q = f.query.trim().toLowerCase();
  if (q) {
    const hay = [r.name, r.area, ...(r.nearby_universities ?? [])].join(' ').toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export function filterAndSort(list: readonly Residence[], f: Filters, sort: SortChoice): Residence[] {
  const matching = list.filter((r) => matchesFilters(r, f));
  if (sort === 'newest') return [...matching].sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
  const byId = new Map(matching.map((r) => [r.id, r]));
  return sortForSearch(matching.map(toRankInput), sort).map((x) => byId.get(x.id)!);
}

// The listings that are still on offer, in the order of `ids` (the newest save first).
// A saved place that was switched off or removed simply drops out of the list.
export function orderByIds<T extends { id: string }>(list: readonly T[], ids: readonly string[]): T[] {
  const byId = new Map(list.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is T => !!r);
}
