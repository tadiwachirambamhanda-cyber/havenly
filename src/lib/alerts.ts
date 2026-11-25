import { formatAedAmount } from './rentSplit';

// Listing alerts: what the bell says, and the switches that control them. The database decides who gets an
// alert (supabase/migrations/20261125100000_alerts.sql); this file only words it.

export interface AlertRow {
  type: 'new_place' | 'price_drop';
  residence?: { name: string } | null;
  old_price_aed?: number | null;
  new_price_aed?: number | null;
}

// Shown when the listing has been hidden since: students can no longer read its name.
export const GONE_ALERT_MESSAGE = 'A place you were told about is no longer listed';

export function alertMessage(n: AlertRow): string {
  const name = n.residence?.name;
  if (!name) return GONE_ALERT_MESSAGE;
  const now = n.new_price_aed != null ? formatAedAmount(n.new_price_aed) : null;
  if (n.type === 'price_drop') {
    if (n.old_price_aed != null && now) return `${name} dropped from ${formatAedAmount(n.old_price_aed)} to ${now} a month`;
    return `${name} dropped its price`;
  }
  return now ? `New place that fits you: ${name}, from ${now} a month` : `New place that fits you: ${name}`;
}

export interface AlertSwitches {
  alert_new_places: boolean;
  alert_price_drops: boolean;
}

// A student who never touched them: price alerts on (they saved the place), new-place alerts off.
export const DEFAULT_ALERT_SWITCHES: AlertSwitches = { alert_new_places: false, alert_price_drops: true };

export type SavedSwitches = { [K in keyof AlertSwitches]?: boolean | null };

export function switchesOf(row: SavedSwitches | null | undefined): AlertSwitches {
  return {
    alert_new_places: row?.alert_new_places ?? DEFAULT_ALERT_SWITCHES.alert_new_places,
    alert_price_drops: row?.alert_price_drops ?? DEFAULT_ALERT_SWITCHES.alert_price_drops,
  };
}

// Why new-place alerts cannot reach this student yet, or null when nothing is missing.
export function newPlaceAlertProblem(p: { budget_aed?: number | null }): string | null {
  return p.budget_aed == null ? 'Add a monthly budget in Edit profile so we know which places fit you.' : null;
}
