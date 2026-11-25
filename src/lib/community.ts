import type { Community, ReportReason } from '@/types';

// Pure rules and wording for Community (F18 to F24). Database calls are in communityApi.ts, photos in
// communityPhotos.ts. Everything here is plain data in and out, so it is tested in community.test.ts.

export const MAX_COMMUNITIES = 20;
export const POST_MAX = 2000;
export const COMMENT_MAX = 1000;
export const MAX_PHOTOS = 4;
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_BUCKET = 'community-photos';
export const PHOTO_LINK_SECONDS = 3600;

// ===== Communities =====

// My communities: my university's community first (joined or not), then the ones I joined, by name.
// Find more: every other community, campus ones first, by name.
export function orderCommunities(
  all: Community[],
  myUniversity: string | null | undefined,
  joinedIds: ReadonlySet<string>,
): { mine: Community[]; uni: Community | null; more: Community[] } {
  const byName = (a: Community, b: Community) => a.name.localeCompare(b.name);
  const uni = myUniversity
    ? all.find((c) => c.category === 'campus' && c.related_university === myUniversity) ?? null
    : null;
  const joined = all.filter((c) => joinedIds.has(c.id) && c.id !== uni?.id).sort(byName);
  const mine = uni ? [uni, ...joined] : joined;
  const mineIds = new Set(mine.map((c) => c.id));
  const more = all
    .filter((c) => !mineIds.has(c.id))
    .sort((a, b) => (a.category === b.category ? byName(a, b) : a.category === 'campus' ? -1 : 1));
  return { mine, uni, more };
}

export function filterCommunities(list: Community[], query: string): Community[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((c) => c.name.toLowerCase().includes(q) || (c.related_university ?? '').toLowerCase().includes(q));
}

// The message when a join would go over the limit; null when it is fine.
export function joinProblem(joinedCount: number): string | null {
  return joinedCount >= MAX_COMMUNITIES
    ? `You can be in up to ${MAX_COMMUNITIES} communities. Leave one to join another.`
    : null;
}

// "Murdoch University Dubai" -> "MU", "Café Hoppers" -> "CH", "AUS Freshers" -> "AF".
const SMALL_WORDS = new Set(['of', 'in', 'the', 'and', 'at', 'for', '&', '-']);
export function communityInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => w && !SMALL_WORDS.has(w.toLowerCase()));
  const letters = words.slice(0, 2).map((w) => [...w][0] ?? '');
  return letters.join('').toUpperCase();
}

export function memberLine(count: number | null | undefined): string {
  const n = Math.max(0, count ?? 0);
  return n === 1 ? '1 member' : `${n.toLocaleString('en-US')} members`;
}

// ===== Posts =====

export interface PostInput { body: string; photoCount: number; communityId: string | null }

export function postProblem(input: PostInput): string | null {
  const body = input.body.trim();
  if (!input.communityId) return 'Choose a community to post in.';
  if (!body) return 'Write something first.';
  if (body.length > POST_MAX) return `Keep your post under ${POST_MAX} characters.`;
  if (input.photoCount > MAX_PHOTOS) return `Add at most ${MAX_PHOTOS} photos.`;
  return null;
}

export function commentProblem(body: string): string | null {
  const t = body.trim();
  if (!t) return 'Write a comment first.';
  if (t.length > COMMENT_MAX) return `Keep your comment under ${COMMENT_MAX} characters.`;
  return null;
}

// ===== Photos =====

const PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heic',
};
const EXT_TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heic' };

// The store accepts jpeg, png, webp and heic only. Returns null for anything else.
export function photoType(mimeType: string | null | undefined, uri: string): { contentType: string; ext: string } | null {
  const mime = (mimeType ?? '').toLowerCase();
  if (PHOTO_TYPES[mime]) {
    const ext = PHOTO_TYPES[mime];
    return { contentType: EXT_TYPES[ext], ext };
  }
  if (mime && !mime.startsWith('application/octet-stream')) return null;
  const fromUri = uri.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() ?? '';
  const ct = EXT_TYPES[fromUri];
  if (!ct) return null;
  return { contentType: ct, ext: PHOTO_TYPES[ct] };
}

// Every photo lives in the author's own folder: <user id>/<file>.
export function photoPath(userId: string, ext: string, now: number, rand: string): string {
  const safe = rand.replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'x';
  return `${userId}/${now}-${safe}.${ext}`;
}

export function photoSizeProblem(bytes: number | null | undefined): string | null {
  if (bytes != null && bytes > PHOTO_MAX_BYTES) return 'That photo is over 5 MB. Choose a smaller one.';
  return null;
}

// ===== Time =====

export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  const date = new Date(iso);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

// ===== Events (Dubai time: UTC+4, no daylight saving) =====

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function dubai(iso: string): Date {
  return new Date(new Date(iso).getTime() + DUBAI_OFFSET_MS);
}

function clock(d: Date): string {
  const h24 = d.getUTCHours();
  const m = d.getUTCMinutes();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? 'am' : 'pm';
  return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

// The berry date block: { day: 'SAT', date: '29', time: '7 pm' }.
export function eventDateBlock(iso: string): { day: string; date: string; month: string; time: string } {
  const d = dubai(iso);
  return { day: DAYS[d.getUTCDay()], date: String(d.getUTCDate()), month: MONTHS[d.getUTCMonth()], time: clock(d) };
}

// "Saturday 29 November, 7 pm (Dubai time)".
export function eventWhen(iso: string): string {
  const d = dubai(iso);
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}, ${clock(d)}`;
}

export function isUpcoming(iso: string, now: number = Date.now()): boolean {
  return new Date(iso).getTime() >= now;
}

// The team types a date (YYYY-MM-DD) and a time (HH:MM, 24-hour) in Dubai time.
export function parseEventWhen(date: string, time: string): { iso: string } | { problem: string } {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!dm) return { problem: 'Write the date as YYYY-MM-DD, for example 2026-12-05.' };
  const tm = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!tm) return { problem: 'Write the time as HH:MM, for example 19:30.' };
  const [y, mo, d] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const [h, mi] = [Number(tm[1]), Number(tm[2])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return { problem: 'That date or time does not exist.' };
  const utc = Date.UTC(y, mo - 1, d, h, mi) - DUBAI_OFFSET_MS;
  const check = new Date(utc + DUBAI_OFFSET_MS);
  if (check.getUTCDate() !== d || check.getUTCMonth() !== mo - 1) return { problem: 'That date does not exist.' };
  return { iso: new Date(utc).toISOString() };
}

// The reverse, for editing: an ISO time as Dubai { date: 'YYYY-MM-DD', time: 'HH:MM' }.
export function eventInputFromIso(iso: string): { date: string; time: string } {
  const d = dubai(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`, time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` };
}

export interface EventInput { title: string; location: string; description: string; date: string; time: string }

export function eventProblem(input: EventInput): string | null {
  if (input.title.trim().length < 3) return 'Give the event a name.';
  if (input.title.trim().length > 120) return 'Keep the name under 120 characters.';
  if (!input.location.trim()) return 'Say where it is.';
  if (input.description.trim().length > 1000) return 'Keep the description under 1000 characters.';
  const when = parseEventWhen(input.date, input.time);
  return 'problem' in when ? when.problem : null;
}

export function goingLine(count: number | null | undefined): string {
  const n = Math.max(0, count ?? 0);
  return `${n} going`;
}

// ===== Reports =====

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'spam', label: 'Spam' },
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'hate', label: 'Hate speech' },
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'scam', label: 'A scam' },
  { key: 'not_student_life', label: 'Not about student life' },
  { key: 'other', label: 'Something else' },
];

export function reasonLabel(r: string): string {
  return REPORT_REASONS.find((x) => x.key === r)?.label ?? r;
}

export function reportedTimes(n: number): string {
  return n === 1 ? 'Reported once' : `Reported ${n} times`;
}

export const AUTO_HIDE_REPORTS = 3;

// ===== Perks =====

// The 4 old "Sample" perks and the Veldemers brand stay hidden from students until the owner decides.
export function isHiddenSampleBrand(name: string | null | undefined): boolean {
  const n = (name ?? '').trim().toLowerCase();
  return n === 'veldemers' || n.startsWith('sample');
}

export interface PerkInput { title: string; discountLabel: string; description: string; address: string; endsOn: string }

export function perkProblem(input: PerkInput): string | null {
  if (input.title.trim().length < 3) return 'Give the perk a title.';
  if (!input.discountLabel.trim()) return 'Add the deal, for example 15% off.';
  if (input.discountLabel.trim().length > 40) return 'Keep the deal under 40 characters.';
  if (input.description.trim().length > 500) return 'Keep the description under 500 characters.';
  if (input.endsOn.trim() && !('iso' in parseEventWhen(input.endsOn, '23:59'))) return 'Write the end date as YYYY-MM-DD, or leave it empty.';
  return null;
}

export function brandProblem(name: string, category: string): string | null {
  if (name.trim().length < 2) return 'Add the brand name.';
  if (!category.trim()) return 'Add a category, for example Cafe.';
  return null;
}

// A friendly message from a database error, keeping the database's own wording when it wrote one for people.
export function friendlyError(e: unknown, fallback: string): string {
  const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message ?? '') : '';
  if (!msg) return fallback;
  if (/network|fetch|timeout/i.test(msg)) return 'Check your connection and try again.';
  if (/violates|policy|permission|row-level|JWT|PGRST|syntax|column|relation/i.test(msg)) return fallback;
  return msg;
}
