import { describe, expect, it } from 'vitest';
import { defaultPeople, formatAedRange, moveInTotal, splitRent } from './rentSplit';

describe('splitRent', () => {
  it("reproduces the design's example: AED 9,000, 3 people, bills AED 450 to 700", () => {
    const r = splitRent({ rentAed: 9000, depositAed: 4500, feesAed: 500, bills: { kind: 'range', minAed: 450, maxAed: 700 }, people: 3 });
    expect(r).not.toBeNull();
    expect(r!.rentEach).toBe(3000);
    expect(r!.bills).toEqual({ kind: 'range', minEach: 150, maxEach: 233 });
    expect(r!.monthlyEachMin).toBe(3150);
    expect(r!.monthlyEachMax).toBe(3233);
    expect(r!.isRange).toBe(true);
    expect(r!.depositEach).toBe(1500);
    expect(r!.depositEachApprox).toBe(false);
    expect(r!.feesEach).toBe(167);
    expect(r!.feesEachApprox).toBe(true);
  });

  it('is a single amount when bills are included', () => {
    const r = splitRent({ rentAed: 9000, bills: { kind: 'included' }, people: 3 })!;
    expect(r.isRange).toBe(false);
    expect(r.monthlyEachMin).toBe(3000);
    expect(r.monthlyEachMax).toBe(3000);
    expect(r.bills).toEqual({ kind: 'included' });
    expect(r.depositEach).toBeNull();
    expect(r.feesEach).toBeNull();
  });

  it('treats unstated bills as none and says so', () => {
    const r = splitRent({ rentAed: 6000, bills: { kind: 'unknown' }, people: 2 })!;
    expect(r.monthlyEachMin).toBe(3000);
    expect(r.bills).toEqual({ kind: 'unknown' });
  });

  it('updates when the number of people changes', () => {
    const base = { rentAed: 9000, bills: { kind: 'range', minAed: 450, maxAed: 700 } } as const;
    expect(splitRent({ ...base, people: 2 })!.monthlyEachMin).toBe(4725);
    expect(splitRent({ ...base, people: 1 })!.monthlyEachMax).toBe(9700);
  });

  it('returns null when it cannot be split', () => {
    const ok = { rentAed: 9000, bills: { kind: 'included' } } as const;
    expect(splitRent({ ...ok, people: 0 })).toBeNull();
    expect(splitRent({ ...ok, people: 11 })).toBeNull();
    expect(splitRent({ ...ok, people: 2.5 })).toBeNull();
    expect(splitRent({ ...ok, rentAed: 0, people: 3 })).toBeNull();
    expect(splitRent({ ...ok, rentAed: -5, people: 3 })).toBeNull();
    expect(splitRent({ rentAed: 9000, bills: { kind: 'range', minAed: 700, maxAed: 450 }, people: 3 })).toBeNull();
    expect(splitRent({ ...ok, depositAed: -1, people: 3 })).toBeNull();
  });
});

describe('moveInTotal', () => {
  it('adds the first month, deposit and one-time fees', () => {
    expect(moveInTotal({ firstMonthAed: 2800, depositAed: 1000, feesAed: 500 })).toBe(4300);
  });
  it('counts missing amounts as none', () => {
    expect(moveInTotal({ firstMonthAed: 2800 })).toBe(2800);
    expect(moveInTotal({ firstMonthAed: 2800, depositAed: null, feesAed: 500 })).toBe(3300);
  });
});

describe('defaultPeople', () => {
  it('is one person per bedroom, and 2 when unknown', () => {
    expect(defaultPeople(3)).toBe(3);
    expect(defaultPeople(1)).toBe(1);
    expect(defaultPeople(null)).toBe(2);
  });
});

describe('formatAedRange', () => {
  it('formats a range and collapses equal ends', () => {
    expect(formatAedRange(3150, 3233)).toBe('AED 3,150 to 3,233');
    expect(formatAedRange(3000, 3000)).toBe('AED 3,000');
  });
});
