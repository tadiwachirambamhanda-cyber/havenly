import { formatAedRange, type RentSplit } from './rentSplit';

// Group enquiry: friends enquire about a whole home together. The rules about who may join and send are in the
// database; this file is the wording and the checks that run before a request is made.

export const GROUP_MIN = 2;
export const GROUP_MAX = 8;
export const CODE_LENGTH = 6;
// Same characters the database uses to make a code: no I, O, 0 or 1, so a code is hard to misread.
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
const PHONE_RE = /^\+?[\d\s()-]{8,20}$/;

export type GroupStatus = 'open' | 'sent' | 'closed';

// What a student typed, cleaned: capitals, no spaces or dashes.
export function cleanCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

export function codeProblem(input: string): string | null {
  const code = cleanCode(input);
  if (!code) return 'Type the 6-character code your friend sent you.';
  if (code.length !== CODE_LENGTH) return 'A group code has 6 characters.';
  if (!CODE_RE.test(code)) return 'That does not look like a group code. Codes use letters and the numbers 2 to 9.';
  return null;
}

export function phoneProblem(input: string): string | null {
  return PHONE_RE.test(input.trim()) ? null : 'Add a phone or WhatsApp number so the team can reach you, e.g. +971 50 123 4567.';
}

export const canSendGroup = (members: number) => members >= GROUP_MIN && members <= GROUP_MAX;

// "About AED 3,150 to 3,233 each a month", or a hint while the group is too small to split.
export function eachPersonLine(split: RentSplit | null, members: number): string {
  if (members < GROUP_MIN) return 'Share the code with your friends. Each person\'s share appears when someone joins.';
  if (!split) return 'We cannot work out each person\'s share yet. The team will confirm the price.';
  return `About ${formatAedRange(split.monthlyEachMin, split.monthlyEachMax)} each a month`;
}

export function groupStatusLine(status: GroupStatus, isOrganiser: boolean, organiserName: string, members: number): string {
  if (status === 'sent') return 'The enquiry was sent to the Havenly team. You will see updates in My enquiries.';
  if (status === 'closed') return 'This group was closed.';
  if (isOrganiser) return members < GROUP_MIN ? 'Waiting for friends to join with your code.' : 'Ready to send when everyone is in.';
  return `Waiting for ${organiserName} to send the enquiry.`;
}

export function shareMessage(code: string, homeName: string): string {
  return `Join my group on Havenly to enquire about ${homeName}. Open Havenly, tap Profile, then "Join with a code", and type ${code}.`;
}

// The database says why a request failed in plain words; anything else gets a general message.
export function groupErrorMessage(e: unknown, fallback: string): string {
  const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (/does not match a group|no longer open|is full|no longer listed|at least 2 people|whole homes|phone or WhatsApp|already sent/i.test(msg)) return msg;
  return fallback;
}
