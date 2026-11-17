import { describe, expect, it } from 'vitest';
import { effectiveMonthlyAed, hasStudentDeal, isStudentFriendly, sortForSearch, type RankInput } from './ranking';

const base = { monthlyAed: 3000, verified: false, billsIncluded: null, studentDealTypes: [], studentRateAed: null } as const;
const make = (id: string, over: Partial<RankInput> = {}): RankInput => ({ id, ...base, studentDealTypes: [], ...over });

describe('isStudentFriendly', () => {
  it('is true when bills are included or there is a student deal', () => {
    expect(isStudentFriendly({ billsIncluded: true, studentDealTypes: [], studentRateAed: null })).toBe(true);
    expect(isStudentFriendly({ billsIncluded: null, studentDealTypes: ['deposit_waived'], studentRateAed: null })).toBe(true);
    expect(isStudentFriendly({ billsIncluded: false, studentDealTypes: [], studentRateAed: 2900 })).toBe(true);
  });
  it('is false for bills not included or not stated and no deal', () => {
    expect(isStudentFriendly({ billsIncluded: false, studentDealTypes: [], studentRateAed: null })).toBe(false);
    expect(isStudentFriendly({ billsIncluded: null, studentDealTypes: [], studentRateAed: null })).toBe(false);
  });
  it('hasStudentDeal reads the deal types or the rate', () => {
    expect(hasStudentDeal({ studentDealTypes: [], studentRateAed: null })).toBe(false);
    expect(hasStudentDeal({ studentDealTypes: [], studentRateAed: 2500 })).toBe(true);
  });
});

describe('effectiveMonthlyAed', () => {
  it('uses the student rate when it is lower, and handles missing values', () => {
    expect(effectiveMonthlyAed(3600, 3300)).toBe(3300);
    expect(effectiveMonthlyAed(3000, 3300)).toBe(3000);
    expect(effectiveMonthlyAed(null, 3300)).toBe(3300);
    expect(effectiveMonthlyAed(3000, null)).toBe(3000);
    expect(effectiveMonthlyAed(null, null)).toBeNull();
  });
});

describe('bad prices', () => {
  it('treats NaN, Infinity, zero and negative prices as unknown', () => {
    expect(effectiveMonthlyAed(Number.NaN, null)).toBeNull();
    expect(effectiveMonthlyAed(Infinity, null)).toBeNull();
    expect(effectiveMonthlyAed(0, null)).toBeNull();
    expect(effectiveMonthlyAed(-500, 2400)).toBe(2400);
    expect(effectiveMonthlyAed(3000, -1)).toBe(3000);
  });
  it('a zero or negative student rate is not a deal', () => {
    expect(hasStudentDeal({ studentDealTypes: [], studentRateAed: 0 })).toBe(false);
    expect(hasStudentDeal({ studentDealTypes: [], studentRateAed: -5 })).toBe(false);
  });
  it('sorts bad prices last and keeps the order of the rest', () => {
    const items = [make('nan', { monthlyAed: Number.NaN }), make('neg', { monthlyAed: -10 }), make('ok-high', { monthlyAed: 4000 }), make('ok-low', { monthlyAed: 2000 }), make('inf', { monthlyAed: Infinity })];
    expect(sortForSearch(items, 'price_low').map((l) => l.id)).toEqual(['ok-low', 'ok-high', 'inf', 'nan', 'neg']);
    expect(sortForSearch(items, 'price_high').map((l) => l.id)).toEqual(['ok-high', 'ok-low', 'inf', 'nan', 'neg']);
  });
});

describe('sortForSearch', () => {
  it('puts a student-friendly listing above an identical one with no deal', () => {
    const plain = make('a', { monthlyAed: 2500 });
    const friendly = make('b', { monthlyAed: 2500, billsIncluded: true });
    expect(sortForSearch([plain, friendly], 'recommended').map((l) => l.id)).toEqual(['b', 'a']);
  });
  it('ranks student-friendly, then Verified, then price', () => {
    const items = [
      make('cheap-plain', { monthlyAed: 1800 }),
      make('verified', { monthlyAed: 2600, verified: true }),
      make('friendly-expensive', { monthlyAed: 4000, billsIncluded: true }),
      make('friendly-verified', { monthlyAed: 3500, billsIncluded: true, verified: true }),
      make('friendly-cheap', { monthlyAed: 3000, studentDealTypes: ['free_first_month'] }),
    ];
    expect(sortForSearch(items, 'recommended').map((l) => l.id)).toEqual([
      'friendly-verified', 'friendly-cheap', 'friendly-expensive', 'verified', 'cheap-plain',
    ]);
  });
  it('sorts by price alone for the price sorts, with unknown prices last', () => {
    const items = [make('mid', { monthlyAed: 3000 }), make('none', { monthlyAed: null }), make('low', { monthlyAed: 2000, billsIncluded: false }), make('high', { monthlyAed: 5000, billsIncluded: true })];
    expect(sortForSearch(items, 'price_low').map((l) => l.id)).toEqual(['low', 'mid', 'high', 'none']);
    expect(sortForSearch(items, 'price_high').map((l) => l.id)).toEqual(['high', 'mid', 'low', 'none']);
  });
  it('counts the student rate as the price and does not change the input', () => {
    const items = [make('a', { monthlyAed: 3600, studentRateAed: 2400 }), make('b', { monthlyAed: 3000 })];
    const copy = [...items];
    expect(sortForSearch(items, 'price_low').map((l) => l.id)).toEqual(['a', 'b']);
    expect(items).toEqual(copy);
  });
  it('breaks ties by id so the order is stable', () => {
    const items = [make('b'), make('a')];
    expect(sortForSearch(items, 'recommended').map((l) => l.id)).toEqual(['a', 'b']);
  });
});
