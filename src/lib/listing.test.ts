import { describe, expect, it } from 'vitest';
import { checkListingFields } from './listing';

const base = { type: 'private_room' as const, bedrooms: null, deposit: '', moveInFee: '', permit: '' };

describe('checkListingFields', () => {
  it('a whole home needs 1 to 3 bedrooms', () => {
    expect(checkListingFields({ ...base, type: 'home', bedrooms: null }).ok).toBe(false);
    expect(checkListingFields({ ...base, type: 'home', bedrooms: 0 }).ok).toBe(false);
    expect(checkListingFields({ ...base, type: 'home', bedrooms: 4 }).ok).toBe(false);
    const ok = checkListingFields({ ...base, type: 'home', bedrooms: 3 });
    expect(ok.ok && ok.value.bedrooms).toBe(3);
  });

  it('any other kind drops the bedroom count', () => {
    for (const type of ['residence', 'shared_room', 'private_room', 'studio'] as const) {
      const res = checkListingFields({ ...base, type, bedrooms: 2 });
      expect(res.ok && res.value.bedrooms).toBe(null);
    }
  });

  it('reads whole AED amounts, with commas, and treats empty as none', () => {
    const res = checkListingFields({ ...base, deposit: '1,000', moveInFee: '' });
    expect(res.ok && res.value.deposit_aed).toBe(1000);
    expect(res.ok && res.value.move_in_fee_aed).toBe(null);
    const zero = checkListingFields({ ...base, deposit: '0' });
    expect(zero.ok && zero.value.deposit_aed).toBe(0);
  });

  it('refuses negative, fractional, non-numeric and typo-sized amounts', () => {
    for (const deposit of ['-500', '1000.50', '1,000.5', 'abc', '1e3', '999999']) {
      expect(checkListingFields({ ...base, deposit }).ok).toBe(false);
    }
    expect(checkListingFields({ ...base, moveInFee: '-1' }).ok).toBe(false);
  });

  it('trims the permit number, turns empty into none, and refuses a long one', () => {
    const res = checkListingFields({ ...base, permit: '  1234567890  ' });
    expect(res.ok && res.value.permit_number).toBe('1234567890');
    const empty = checkListingFields({ ...base, permit: '   ' });
    expect(empty.ok && empty.value.permit_number).toBe(null);
    expect(checkListingFields({ ...base, permit: 'x'.repeat(41) }).ok).toBe(false);
  });
});
