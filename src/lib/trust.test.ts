import { describe, it, expect } from 'vitest';
import { formatCheckedDate } from './trust';

describe('formatCheckedDate', () => {
  it('formats a date', () => expect(formatCheckedDate('2026-11-12T08:00:00Z')).toBe('12 November 2026'));
  it('uses the Dubai day (UTC+4)', () => {
    expect(formatCheckedDate('2026-11-12T20:30:00Z')).toBe('13 November 2026');
    expect(formatCheckedDate('2026-12-31T21:00:00Z')).toBe('1 January 2027');
  });
  it('returns null for nothing or rubbish', () => {
    expect(formatCheckedDate(null)).toBeNull();
    expect(formatCheckedDate(undefined)).toBeNull();
    expect(formatCheckedDate('')).toBeNull();
    expect(formatCheckedDate('not a date')).toBeNull();
  });
});
