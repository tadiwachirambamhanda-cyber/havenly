import { describe, expect, it } from 'vitest';
import cases from './alertPriceCases.json';
import { priceInfo } from '../components/housing/listingModel';
import { GONE_ALERT_MESSAGE, alertMessage, newPlaceAlertProblem, switchesOf } from './alerts';
import type { BillingPeriod, Residence, RoomType } from '../types';

// The same cases run in the database test (scripts/db-tests/alerts.py) against private.listing_from_aed,
// so the price in an alert is always the price on the card.
type Case = { name: string; rooms: [number, BillingPeriod, boolean][]; studentRate: number | null; from: number | null };

function listing(c: Case): Residence {
  const room_types = c.rooms.map(([price_aed, billing_period, is_available], i) =>
    ({ id: `r${i}`, price_aed, billing_period, is_available }) as RoomType);
  return { room_types, student_rate_aed: c.studentRate } as Residence;
}

describe('alert price matches the card price', () => {
  for (const c of cases as Case[]) {
    it(c.name, () => {
      // A place with no room that can be booked is never alerted, whatever its student rate.
      const bookable = c.rooms.some(([, , available]) => available);
      expect(bookable ? priceInfo(listing(c)).now : null).toBe(c.from);
    });
  }
});

describe('alertMessage', () => {
  it('words a price drop with both prices', () => {
    expect(alertMessage({ type: 'price_drop', residence: { name: 'Marina Heights' }, old_price_aed: 3200, new_price_aed: 2900 }))
      .toBe('Marina Heights dropped from AED 3,200 to AED 2,900 a month');
  });
  it('words a new place with its price', () => {
    expect(alertMessage({ type: 'new_place', residence: { name: 'Al Barsha Studios' }, new_price_aed: 2750 }))
      .toBe('New place that fits you: Al Barsha Studios, from AED 2,750 a month');
  });
  it('says the place is gone when its name can no longer be read', () => {
    expect(alertMessage({ type: 'price_drop', residence: null, old_price_aed: 3200, new_price_aed: 2900 })).toBe(GONE_ALERT_MESSAGE);
  });
});

describe('alert switches', () => {
  it('defaults to price alerts on and new-place alerts off', () => {
    expect(switchesOf(null)).toEqual({ alert_new_places: false, alert_price_drops: true });
    expect(switchesOf({ alert_new_places: true })).toEqual({ alert_new_places: true, alert_price_drops: true });
  });
  it('needs a budget before new-place alerts can match', () => {
    expect(newPlaceAlertProblem({ budget_aed: null })).toMatch(/budget/);
    expect(newPlaceAlertProblem({ budget_aed: 3000 })).toBeNull();
  });
});
