import { describe, expect, it } from 'vitest';
import { checkBills, checkCommutes, checkHousemates, checkListingFields, checkStudentDeal } from './listing';

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
    const plain = checkListingFields({ ...base, deposit: '12500', moveInFee: '12,500' });
    expect(plain.ok && plain.value.deposit_aed).toBe(12500);
    expect(plain.ok && plain.value.move_in_fee_aed).toBe(12500);
    const padded = checkListingFields({ ...base, deposit: '  1,000  ' });
    expect(padded.ok && padded.value.deposit_aed).toBe(1000);
    expect(res.ok && res.value.move_in_fee_aed).toBe(null);
    const zero = checkListingFields({ ...base, deposit: '0' });
    expect(zero.ok && zero.value.deposit_aed).toBe(0);
  });

  it('refuses negative, fractional, non-numeric and typo-sized amounts', () => {
    for (const deposit of ['-500', '1000.50', '1,000.5', 'abc', '1e3', '999999']) {
      expect(checkListingFields({ ...base, deposit }).ok).toBe(false);
    }
  });

  it('refuses badly placed commas and spaces inside an amount', () => {
    for (const deposit of ['1,,0', '1 0 0 0', '1,00', '10,00', ',100', '100,', '1,0000', '1, 000']) {
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

describe('checkBills', () => {
  it('bills in the rent drop the estimate', () => {
    const res = checkBills({ included: true, min: '450', max: '700' });
    expect(res.ok && res.value).toEqual({ bills_included: true, bills_min_aed: null, bills_max_aed: null });
  });

  it('bills not in the rent keep a from and to estimate', () => {
    const res = checkBills({ included: false, min: '450', max: '1,700' });
    expect(res.ok && res.value).toEqual({ bills_included: false, bills_min_aed: 450, bills_max_aed: 1700 });
    expect(checkBills({ included: false, min: '500', max: '500' }).ok).toBe(true);
  });

  it('refuses only one of the two numbers', () => {
    const a = checkBills({ included: false, min: '450', max: '' });
    const b = checkBills({ included: false, min: '', max: '700' });
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    expect(!a.ok && a.field).toBe('billsMax');
    expect(!b.ok && b.field).toBe('billsMin');
  });

  it('refuses a top below the bottom, negatives, decimals and typo-sized amounts', () => {
    const low = checkBills({ included: false, min: '700', max: '450' });
    expect(!low.ok && low.error).toContain('lower');
    for (const min of ['-5', '4.5', 'abc', '99999']) {
      expect(checkBills({ included: false, min, max: '100000' }).ok).toBe(false);
    }
  });

  it('keeps "not stated" when nothing is entered, and implies "not included" when an estimate is', () => {
    const none = checkBills({ included: null, min: '', max: '' });
    expect(none.ok && none.value.bills_included).toBe(null);
    const off = checkBills({ included: false, min: '', max: '' });
    expect(off.ok && off.value.bills_included).toBe(false);
    const implied = checkBills({ included: null, min: '300', max: '400' });
    expect(implied.ok && implied.value.bills_included).toBe(false);
  });
});

describe('checkStudentDeal', () => {
  it('switch off means no deal and no rate', () => {
    const res = checkStudentDeal({ on: false, types: ['student_rate'], rate: '2000' });
    expect(res.ok && res.value).toEqual({ student_deal_types: [], student_rate_aed: null });
  });

  it('switch on needs at least one type', () => {
    const res = checkStudentDeal({ on: true, types: [], rate: '' });
    expect(!res.ok && res.field).toBe('dealTypes');
  });

  it('keeps the ticked types and a student rate', () => {
    const res = checkStudentDeal({ on: true, types: ['free_first_month', 'student_rate'], rate: '2,500' });
    expect(res.ok && res.value).toEqual({ student_deal_types: ['student_rate', 'free_first_month'], student_rate_aed: 2500 });
    const noRate = checkStudentDeal({ on: true, types: ['deposit_waived'], rate: '' });
    expect(noRate.ok && noRate.value.student_rate_aed).toBe(null);
  });

  it('refuses a student rate of 0 or below, decimals and typo-sized amounts', () => {
    for (const rate of ['0', '-100', '2500.5', 'abc', '60000']) {
      const res = checkStudentDeal({ on: true, types: ['student_rate'], rate });
      expect(res.ok).toBe(false);
      expect(!res.ok && res.field).toBe('studentRate');
    }
  });

  it('refuses a rate when the Student rate type is not ticked, and unknown types', () => {
    expect(checkStudentDeal({ on: true, types: ['deposit_waived'], rate: '2500' }).ok).toBe(false);
    expect(checkStudentDeal({ on: true, types: ['half_price' as never], rate: '' }).ok).toBe(false);
  });
});

describe('checkHousemates', () => {
  it('empty means not known; 0 to 10 are fine', () => {
    const none = checkHousemates('  ');
    expect(none.ok && none.value).toBe(null);
    const zero = checkHousemates('0');
    expect(zero.ok && zero.value).toBe(0);
    const ten = checkHousemates('10');
    expect(ten.ok && ten.value).toBe(10);
  });

  it('refuses 11, negatives, decimals and words', () => {
    for (const raw of ['11', '-1', '2.5', 'two']) expect(checkHousemates(raw).ok).toBe(false);
  });
});

describe('checkCommutes', () => {
  const row = { university: 'Heriot-Watt University Dubai', minutes: '18', mode: 'bus' as const };

  it('accepts complete rows, trims the name and ignores empty rows', () => {
    const res = checkCommutes([{ ...row, university: '  Heriot-Watt University Dubai ', minutes: ' 18 ' }, { university: '', minutes: '', mode: null }]);
    expect(res.ok && res.value).toEqual([{ university: 'Heriot-Watt University Dubai', minutes: 18, mode: 'bus' }]);
    const empty = checkCommutes([]);
    expect(empty.ok && empty.value).toEqual([]);
  });

  it('needs a university', () => {
    expect(checkCommutes([{ ...row, university: ' ' }]).ok).toBe(false);
  });

  it('needs minutes above 0, as a whole number', () => {
    for (const minutes of ['', '0', '-5', '1.5', 'x', '500']) expect(checkCommutes([{ ...row, minutes }]).ok).toBe(false);
  });

  it('needs one of bus, metro, walk, taxi or shuttle', () => {
    expect(checkCommutes([{ ...row, mode: null }]).ok).toBe(false);
    expect(checkCommutes([{ ...row, mode: 'plane' as never }]).ok).toBe(false);
    for (const mode of ['bus', 'metro', 'walk', 'taxi', 'shuttle'] as const) expect(checkCommutes([{ ...row, mode }]).ok).toBe(true);
  });

  it('refuses the same university twice', () => {
    expect(checkCommutes([row, { ...row, mode: 'metro' }]).ok).toBe(false);
  });
});

describe('field names on the existing checks', () => {
  it('say which box is wrong', () => {
    const dep = checkListingFields({ ...base, deposit: '1000.50' });
    expect(!dep.ok && dep.field).toBe('deposit');
    const bed = checkListingFields({ ...base, type: 'home', bedrooms: null });
    expect(!bed.ok && bed.field).toBe('bedrooms');
  });
});
