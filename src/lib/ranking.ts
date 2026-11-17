// Shared, pure rules for what counts as "student-friendly" and how search results are
// ordered (docs/prd.md requirement 10). No React Native imports, so they run in tests.
// Lane A applies them in the Housing search; Lane B's admin form only sets the fields.

export interface RankInput {
  id: string;
  // The cheapest monthly price, whole AED, or null when unknown (compare yearly and
  // semester prices as monthly equivalents before passing them in).
  monthlyAed: number | null;
  verified: boolean;
  billsIncluded: boolean | null;
  studentDealTypes: readonly string[];
  // Discounted rent per month when the listing has a student rate.
  studentRateAed: number | null;
}

export type SortKey = 'recommended' | 'price_low' | 'price_high';

// A usable price is a finite number above zero. NaN, Infinity, zero and negatives count as
// unknown, so a bad value can never rank as the cheapest listing or break the sort.
const cleanPrice = (n: number | null): number | null => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null);

export const hasStudentDeal = (l: Pick<RankInput, 'studentDealTypes' | 'studentRateAed'>): boolean =>
  l.studentDealTypes.length > 0 || cleanPrice(l.studentRateAed) != null;

// The "Student-friendly" badge: bills are in the rent, or the listing has a student deal.
export const isStudentFriendly = (l: Pick<RankInput, 'billsIncluded' | 'studentDealTypes' | 'studentRateAed'>): boolean =>
  l.billsIncluded === true || hasStudentDeal(l);

// What a student actually pays a month: the student rate when it is lower.
export function effectiveMonthlyAed(monthlyAed: number | null, studentRateAed: number | null): number | null {
  const monthly = cleanPrice(monthlyAed);
  const rate = cleanPrice(studentRateAed);
  if (rate == null) return monthly;
  if (monthly == null) return rate;
  return Math.min(monthly, rate);
}

const priceOf = (l: RankInput) => effectiveMonthlyAed(l.monthlyAed, l.studentRateAed);

// Unknown prices always sort last.
function comparePrice(a: RankInput, b: RankInput, direction: 1 | -1): number {
  const pa = priceOf(a);
  const pb = priceOf(b);
  if (pa == null && pb == null) return 0;
  if (pa == null) return 1;
  if (pb == null) return -1;
  return (pa - pb) * direction;
}

// Recommended: student-friendly first, then Verified, then the lowest price. The other
// two sorts are by price only. Ties fall back to id so the order never jumps around.
export function sortForSearch<T extends RankInput>(items: readonly T[], sort: SortKey): T[] {
  const copy = [...items];
  copy.sort((a, b) => {
    if (sort === 'recommended') {
      const friendly = Number(isStudentFriendly(b)) - Number(isStudentFriendly(a));
      if (friendly !== 0) return friendly;
      const verified = Number(b.verified) - Number(a.verified);
      if (verified !== 0) return verified;
    }
    const price = comparePrice(a, b, sort === 'price_high' ? -1 : 1);
    return price !== 0 ? price : a.id.localeCompare(b.id);
  });
  return copy;
}
