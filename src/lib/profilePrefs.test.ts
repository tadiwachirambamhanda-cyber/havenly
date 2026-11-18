import { describe, it, expect } from 'vitest';
import { hasPreferences, parseBudget, preferenceSummary, usableMoveIn } from './profilePrefs';

describe('parseBudget', () => {
  it('treats empty as no budget', () => {
    expect(parseBudget('')).toEqual({ value: null, error: null });
    expect(parseBudget('   ')).toEqual({ value: null, error: null });
  });
  it('reads whole numbers, with commas and an AED prefix', () => {
    expect(parseBudget('3000').value).toBe(3000);
    expect(parseBudget('3,000').value).toBe(3000);
    expect(parseBudget('AED 2,500').value).toBe(2500);
  });
  it('refuses text, decimals, zero, negatives and amounts over the limit', () => {
    for (const bad of ['abc', '2500.50', '0', '-5', '100001', '1e5']) {
      const r = parseBudget(bad);
      expect(r.value, bad).toBeNull();
      expect(r.error, bad).not.toBeNull();
    }
  });
  it('accepts the limits', () => {
    expect(parseBudget('1').value).toBe(1);
    expect(parseBudget('100000').value).toBe(100000);
  });
});

describe('preferenceSummary', () => {
  it('is null when nothing is set', () => {
    expect(preferenceSummary({})).toBeNull();
    expect(preferenceSummary({ budget_aed: null, move_in_month: null, housemate_pref: 'any' })).toBeNull();
  });
  it('joins what is set', () => {
    expect(preferenceSummary({ budget_aed: 3000, move_in_month: '2026-09-01', housemate_pref: 'female_only' }))
      .toBe('Up to AED 3,000 a month · from September 2026 · women only');
    expect(preferenceSummary({ budget_aed: 2500 })).toBe('Up to AED 2,500 a month');
    expect(preferenceSummary({ housemate_pref: 'male_only' })).toBe('men only');
  });
  it('hasPreferences ignores "anyone"', () => {
    expect(hasPreferences({ housemate_pref: 'any' })).toBe(false);
    expect(hasPreferences({ budget_aed: 1 })).toBe(true);
  });
});

describe('usableMoveIn', () => {
  const upcoming = ['2026-12-01', '2027-01-01'];
  it('keeps a month that is still on offer', () => expect(usableMoveIn('2027-01-01', upcoming)).toBe('2027-01-01'));
  it('drops a month that has passed or is unset', () => {
    expect(usableMoveIn('2026-09-01', upcoming)).toBeNull();
    expect(usableMoveIn(null, upcoming)).toBeNull();
  });
});
