// A visitor who makes an account from a listing should land back on that listing. The
// sign-in sheet notes where they were; the Housing tab (which appears once they have an
// account) reads it once and opens the listing. Kept in memory and dropped after 30 minutes.
const MAX_AGE_MS = 30 * 60 * 1000;

let pending: { residenceId: string; at: number } | null = null;

export function setPendingReturn(residenceId: string, now: number = Date.now()): void {
  pending = { residenceId, at: now };
}

export function clearPendingReturn(): void {
  pending = null;
}

export function takePendingReturn(now: number = Date.now()): string | null {
  const p = pending;
  pending = null;
  if (!p || now - p.at > MAX_AGE_MS) return null;
  return p.residenceId;
}
