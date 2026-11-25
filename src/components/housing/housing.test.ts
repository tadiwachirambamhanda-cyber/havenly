import { describe, expect, it } from 'vitest';
import type { Residence } from '../../types';
import {
  EMPTY_FILTERS, billsLine, eachPersonLine, filterAndSort, moreFiltersCount, morePillLabel, moveInRows, monthlyAedOf, pickCommute, priceInfo,
  pricePillLabel, splitPanel, whoPillLabel,
} from './listingModel';
import { clearPendingReturn, setPendingReturn, takePendingReturn } from './pendingReturn';

let n = 0;
function make(over: Partial<Residence> & { monthly?: number | null } = {}): Residence {
  n += 1;
  const { monthly, ...rest } = over;
  const price = monthly === undefined ? 3000 : monthly;
  return {
    id: `r${n}`, name: `Sample listing ${n}`, provider_name: 'Sample', description: null, area: 'Al Barsha', address: null,
    latitude: null, longitude: null, photo_urls: [], amenities: [], nearby_universities: ['Sample University'],
    gender_policy: 'mixed', is_active: true, created_at: `2026-11-${String(10 + n).padStart(2, '0')}T00:00:00Z`,
    listing_type: 'private_room', bedrooms: null, deposit_aed: null, move_in_fee_aed: null, is_verified: false, verified_at: null,
    permit_number: null, bills_included: null, bills_min_aed: null, bills_max_aed: null, student_deal_types: [],
    student_rate_aed: null, housemates: null, commutes: [],
    room_types: price == null ? [] : [{ id: `rt${n}`, residence_id: `r${n}`, name: 'Room', price_aed: price, billing_period: 'month', occupancy: 1, is_available: true, sort_order: 0, created_at: '' }],
    ...rest,
  };
}

describe('prices', () => {
  it('converts yearly and semester prices to a month', () => {
    const r = make({ monthly: null, room_types: [
      { id: 'a', residence_id: 'x', name: 'A', price_aed: 36000, billing_period: 'year', occupancy: 1, is_available: true, sort_order: 0, created_at: '' },
      { id: 'b', residence_id: 'x', name: 'B', price_aed: 21000, billing_period: 'semester', occupancy: 1, is_available: false, sort_order: 1, created_at: '' },
    ] });
    expect(monthlyAedOf(r)).toBe(3000);
  });
  it('shows the student rate with the normal price struck through', () => {
    const r = make({ monthly: 3600, student_deal_types: ['student_rate'], student_rate_aed: 3300 });
    expect(priceInfo(r)).toEqual({ now: 3300, was: 3600 });
    expect(priceInfo(make({ monthly: 3600 }))).toEqual({ now: 3600, was: null });
  });
});

describe('bills, split line and move-in total', () => {
  it('describes bills', () => {
    expect(billsLine(make({ bills_included: true }))).toBe('Bills included');
    expect(billsLine(make({ bills_included: false, bills_min_aed: 350, bills_max_aed: 500 }))).toBe('Bills not included, about AED 350 to 500 a month');
  });
  it('gives the per-person range for a 3 bedroom home (design example)', () => {
    const home = make({ monthly: 9000, listing_type: 'home', bedrooms: 3, bills_included: false, bills_min_aed: 450, bills_max_aed: 700 });
    expect(eachPersonLine(home)).toBe('About AED 3,150 to 3,233 each for 3 people');
    expect(eachPersonLine(make())).toBeNull();
    expect(eachPersonLine(make({ monthly: null, listing_type: 'home', bedrooms: 3 }))).toBeNull();
  });
  it('adds up the move-in costs', () => {
    expect(moveInRows(make({ monthly: 2800, deposit_aed: 1000, move_in_fee_aed: 500 }))?.total).toBe(4300);
    expect(moveInRows(make({ monthly: null }))).toBeNull();
  });
});

describe('filters and sort', () => {
  const a = make({ monthly: 2800, listing_type: 'private_room', gender_policy: 'female_only', is_verified: true, bills_included: true });
  const b = make({ monthly: 3500, listing_type: 'private_room', gender_policy: 'female_only' });
  const c = make({ monthly: 9000, listing_type: 'home', bedrooms: 2 });
  const d = make({ monthly: 8000, listing_type: 'home', bedrooms: 3 });
  const e = make({ monthly: null, listing_type: 'studio' });
  const all = [a, b, c, d, e];
  it('combines kind, price and gender', () => {
    const f = { ...EMPTY_FILTERS, kind: 'private_room' as const, maxMonthly: 3000, gender: 'female_only' as const };
    expect(filterAndSort(all, f, 'recommended').map((r) => r.id)).toEqual([a.id]);
  });
  it('shows only 2 bedroom homes', () => {
    expect(filterAndSort(all, { ...EMPTY_FILTERS, kind: 'home', bedrooms: 2 }, 'recommended').map((r) => r.id)).toEqual([c.id]);
  });
  it('filters Verified and Bills included', () => {
    expect(filterAndSort(all, { ...EMPTY_FILTERS, verified: true }, 'recommended')).toEqual([a]);
    expect(filterAndSort(all, { ...EMPTY_FILTERS, billsIncluded: true }, 'recommended')).toEqual([a]);
  });
  it('sorts by price with unknown prices last, and brings everything back when cleared', () => {
    expect(filterAndSort(all, EMPTY_FILTERS, 'price_low').map((r) => r.id)).toEqual([a.id, b.id, d.id, c.id, e.id]);
    expect(filterAndSort(all, EMPTY_FILTERS, 'price_high')[0].id).toBe(c.id);
    expect(filterAndSort(all, EMPTY_FILTERS, 'newest')[0].id).toBe(e.id);
    expect(filterAndSort(all, EMPTY_FILTERS, 'recommended')).toHaveLength(5);
  });
  it('ranks a student deal above an identical listing without one', () => {
    const plain = make({ monthly: 3000 });
    const deal = make({ monthly: 3000, student_deal_types: ['deposit_waived'] });
    expect(filterAndSort([plain, deal], EMPTY_FILTERS, 'recommended')[0].id).toBe(deal.id);
    expect(filterAndSort([plain, deal], { ...EMPTY_FILTERS, studentDeal: true }, 'recommended')).toEqual([deal]);
  });
  it('searches name, area and university', () => {
    expect(filterAndSort(all, { ...EMPTY_FILTERS, query: 'sample university' }, 'recommended')).toHaveLength(5);
    expect(filterAndSort(all, { ...EMPTY_FILTERS, query: 'nowhere' }, 'recommended')).toHaveLength(0);
  });
});

describe('commute', () => {
  it('prefers the student university, else the shortest', () => {
    const r = make({ commutes: [{ university: 'A', minutes: 30, mode: 'bus' }, { university: 'B', minutes: 10, mode: 'metro' }] });
    expect(pickCommute(r, 'A')?.minutes).toBe(30);
    expect(pickCommute(r, null)?.university).toBe('B');
    expect(pickCommute(make(), 'A')).toBeNull();
  });
});


describe('return to listing', () => {
  it('is read once and expires', () => {
    setPendingReturn('x', 1000);
    expect(takePendingReturn(2000)).toBe('x');
    expect(takePendingReturn(2000)).toBeNull();
    setPendingReturn('y', 0);
    expect(takePendingReturn(31 * 60 * 1000)).toBeNull();
    clearPendingReturn();
  });
});

describe('Housing pills (F16)', () => {
  it('price pill names the cap, or AED 3,000 when none is set', () => {
    expect(pricePillLabel(null)).toBe('Under AED 3,000');
    expect(pricePillLabel(2500)).toBe('Under AED 2,500');
  });

  it('who pill', () => {
    expect(whoPillLabel(null)).toBe('Who it’s for');
    expect(whoPillLabel('female_only')).toBe('Female only');
  });

  it('More filters counts bills, deal, bedrooms (once) and Verified', () => {
    expect(morePillLabel(EMPTY_FILTERS)).toBe('More filters');
    const all = { ...EMPTY_FILTERS, billsIncluded: true, studentDeal: true, bedrooms: 2 as const, verified: true };
    expect(moreFiltersCount(all)).toBe(4);
    expect(morePillLabel(all)).toBe('More filters · 4');
    // Price, kind, who and search have their own controls and do not count.
    expect(moreFiltersCount({ ...EMPTY_FILTERS, maxMonthly: 3000, kind: 'studio', gender: 'mixed', query: 'JLT' })).toBe(0);
  });
});

describe('rent split panel (F16)', () => {
  const home = (over: Partial<Residence> & { monthly?: number | null } = {}) => make({
    listing_type: 'home', bedrooms: 3, monthly: 9000, bills_included: false, bills_min_aed: 450, bills_max_aed: 700, deposit_aed: 4500, ...over,
  });

  it('the handoff numbers: 3 people, then 2', () => {
    expect(splitPanel(home(), 3)).toEqual({
      people: 3, peopleLabel: '3 people', each: 'About AED 3,150 to 3,233 each a month',
      note: 'Each pays rent plus their share of bills. Deposit AED 1,500 each.',
    });
    const two = splitPanel(home(), 2)!;
    expect(two.each).toBe('About AED 4,725 to 4,850 each a month');
    expect(two.note).toContain('Deposit AED 2,250 each.');
    expect(splitPanel(home(), 1)!.peopleLabel).toBe('1 person');
  });

  it('bills included, unknown bills, no deposit, uneven deposit', () => {
    expect(splitPanel(home({ bills_included: true }), 3)).toMatchObject({ each: 'AED 3,000 each a month', note: 'Bills are included in the rent. Deposit AED 1,500 each.' });
    expect(splitPanel(home({ bills_included: null, bills_min_aed: null, bills_max_aed: null }), 3)!.note).toBe('Rent only: bills are not listed yet. Deposit AED 1,500 each.');
    expect(splitPanel(home({ deposit_aed: null }), 3)!.note).toBe('Each pays rent plus their share of bills.');
    expect(splitPanel(home({ deposit_aed: 5000 }), 3)!.note).toContain('Deposit about AED 1,667 each.');
  });

  it('nothing for a room, a home with no price, or a bad count', () => {
    expect(splitPanel(make(), 2)).toBeNull();
    expect(splitPanel(home({ monthly: null }), 3)).toBeNull();
    expect(splitPanel(home(), 11)).toBeNull();
  });
});
