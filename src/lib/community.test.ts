import { describe, it, expect } from 'vitest';
import type { Community } from '@/types';
import {
  orderCommunities, filterCommunities, joinProblem, communityInitials, memberLine, postProblem, commentProblem,
  photoType, photoPath, photoSizeProblem, timeAgo, eventDateBlock, eventWhen, isUpcoming, parseEventWhen,
  eventInputFromIso, eventProblem, reasonLabel, reportedTimes, isHiddenSampleBrand, perkProblem, brandProblem,
  friendlyError, REPORT_REASONS, MAX_COMMUNITIES,
} from './community';

const c = (id: string, name: string, category: 'campus' | 'interest', uni: string | null = null): Community => ({
  id, name, emoji: '', description: '', category, related_interest: null, related_university: uni, member_count: 0, created_at: '',
});
const all = [
  c('a', 'Murdoch University Dubai', 'campus', 'Murdoch University Dubai'),
  c('b', 'Canadian University Dubai', 'campus', 'Canadian University Dubai'),
  c('c', 'Café Hoppers', 'interest'),
  c('d', 'American University in Dubai', 'campus', 'American University in Dubai'),
];

describe('orderCommunities (F18)', () => {
  it('puts my university first, then joined ones, and the rest in Find more', () => {
    const r = orderCommunities(all, 'Murdoch University Dubai', new Set(['c', 'b']));
    expect(r.uni?.id).toBe('a');
    expect(r.mine.map((x) => x.id)).toEqual(['a', 'c', 'b']);
    expect(r.more.map((x) => x.id)).toEqual(['d']);
  });
  it('shows my university first even before I join it, and never twice', () => {
    const r = orderCommunities(all, 'Murdoch University Dubai', new Set(['a']));
    expect(r.mine.map((x) => x.id)).toEqual(['a']);
  });
  it('a left community moves back to Find more', () => {
    const r = orderCommunities(all, null, new Set());
    expect(r.mine).toEqual([]);
    expect(r.more.map((x) => x.id)).toEqual(['d', 'b', 'a', 'c']);
  });
  it('filters by name', () => expect(filterCommunities(all, 'canad').map((x) => x.id)).toEqual(['b']));
});

describe('joinProblem', () => {
  it('refuses a 21st community with a clear message', () => {
    expect(joinProblem(MAX_COMMUNITIES - 1)).toBeNull();
    expect(joinProblem(MAX_COMMUNITIES)).toMatch(/up to 20 communities/);
  });
});

describe('wording', () => {
  it('community initials', () => {
    expect(communityInitials('Murdoch University Dubai')).toBe('MU');
    expect(communityInitials('American University in Dubai')).toBe('AU');
    expect(communityInitials('Café Hoppers')).toBe('CH');
  });
  it('member line', () => {
    expect(memberLine(1)).toBe('1 member');
    expect(memberLine(1200)).toBe('1,200 members');
    expect(memberLine(null)).toBe('0 members');
  });
});

describe('postProblem (F19)', () => {
  const ok = { body: 'Anyone near DIAC?', photoCount: 2, communityId: 'b' };
  it('accepts a normal post', () => expect(postProblem(ok)).toBeNull());
  it('needs text, a community and at most 4 photos', () => {
    expect(postProblem({ ...ok, body: '   ' })).not.toBeNull();
    expect(postProblem({ ...ok, communityId: null })).not.toBeNull();
    expect(postProblem({ ...ok, photoCount: 5 })).not.toBeNull();
    expect(postProblem({ ...ok, body: 'x'.repeat(2001) })).not.toBeNull();
  });
  it('comments need text', () => {
    expect(commentProblem(' ')).not.toBeNull();
    expect(commentProblem('Bus 84')).toBeNull();
  });
});

describe('photos (private store)', () => {
  it('accepts jpeg, png, webp and heic only', () => {
    expect(photoType('image/jpeg', 'x')).toEqual({ contentType: 'image/jpeg', ext: 'jpg' });
    expect(photoType('image/heic', 'x')?.ext).toBe('heic');
    expect(photoType('image/gif', 'x')).toBeNull();
    expect(photoType(null, 'file:///a/b.PNG')).toEqual({ contentType: 'image/png', ext: 'png' });
    expect(photoType(null, 'blob:abc')).toBeNull();
  });
  it('keeps every photo in the author folder', () => {
    const p = photoPath('user-1', 'jpg', 123, 'ab/../c');
    expect(p.startsWith('user-1/')).toBe(true);
    expect(p).not.toContain('..');
    expect(p.split('/')).toHaveLength(2);
  });
  it('refuses photos over 5 MB', () => {
    expect(photoSizeProblem(5 * 1024 * 1024)).toBeNull();
    expect(photoSizeProblem(5 * 1024 * 1024 + 1)).not.toBeNull();
  });
});

describe('time', () => {
  const now = Date.parse('2026-11-25T12:00:00Z');
  it('time ago', () => {
    expect(timeAgo('2026-11-25T11:59:40Z', now)).toBe('now');
    expect(timeAgo('2026-11-25T10:00:00Z', now)).toBe('2h');
    expect(timeAgo('2026-11-24T12:00:00Z', now)).toBe('1d');
    expect(timeAgo('2026-11-11T12:00:00Z', now)).toBe('2w');
  });
});

describe('events in Dubai time (F22)', () => {
  it('reads a date and time as Dubai time', () => {
    const r = parseEventWhen('2026-11-29', '19:00');
    expect(r).toEqual({ iso: '2026-11-29T15:00:00.000Z' });
  });
  it('shows the date block and the long date in Dubai time', () => {
    expect(eventDateBlock('2026-11-29T15:00:00.000Z')).toEqual({ day: 'SUN', date: '29', month: 'Nov', time: '7 pm' });
    expect(eventWhen('2026-11-29T15:30:00.000Z')).toBe('Sunday 29 November, 7:30 pm');
    // 22:30 UTC is already the next day in Dubai.
    expect(eventDateBlock('2026-11-28T22:30:00.000Z').date).toBe('29');
  });
  it('round-trips for editing', () => {
    expect(eventInputFromIso('2026-11-29T15:05:00.000Z')).toEqual({ date: '2026-11-29', time: '19:05' });
  });
  it('refuses dates that do not exist', () => {
    expect('problem' in parseEventWhen('2026-02-30', '10:00')).toBe(true);
    expect('problem' in parseEventWhen('29/11/2026', '10:00')).toBe(true);
    expect('problem' in parseEventWhen('2026-11-29', '25:00')).toBe(true);
  });
  it('past events are not upcoming', () => {
    const now = Date.parse('2026-11-25T12:00:00Z');
    expect(isUpcoming('2026-11-25T11:00:00Z', now)).toBe(false);
    expect(isUpcoming('2026-11-26T11:00:00Z', now)).toBe(true);
  });
  it('event form checks', () => {
    const ok = { title: 'Move-in meetup', location: 'Dubai Knowledge Park', description: '', date: '2026-11-29', time: '19:00' };
    expect(eventProblem(ok)).toBeNull();
    expect(eventProblem({ ...ok, title: '' })).not.toBeNull();
    expect(eventProblem({ ...ok, location: ' ' })).not.toBeNull();
    expect(eventProblem({ ...ok, time: '7pm' })).not.toBeNull();
  });
});

describe('reports (F24)', () => {
  it('covers every reason the database accepts', () => {
    expect(REPORT_REASONS.map((r) => r.key).sort()).toEqual(['harassment', 'hate', 'inappropriate', 'not_student_life', 'other', 'scam', 'spam']);
    expect(reasonLabel('spam')).toBe('Spam');
  });
  it('counts', () => {
    expect(reportedTimes(1)).toBe('Reported once');
    expect(reportedTimes(3)).toBe('Reported 3 times');
  });
});

describe('perks (F23)', () => {
  it('hides the old sample perks and Veldemers from students', () => {
    expect(isHiddenSampleBrand('Sample Café')).toBe(true);
    expect(isHiddenSampleBrand('Veldemers')).toBe(true);
    expect(isHiddenSampleBrand('  veldemers ')).toBe(true);
    expect(isHiddenSampleBrand('Kinokuniya')).toBe(false);
  });
  it('perk and brand form checks', () => {
    const ok = { title: '15% off coffee', discountLabel: '15% off', description: '', address: '', endsOn: '' };
    expect(perkProblem(ok)).toBeNull();
    expect(perkProblem({ ...ok, discountLabel: '' })).not.toBeNull();
    expect(perkProblem({ ...ok, endsOn: 'soon' })).not.toBeNull();
    expect(perkProblem({ ...ok, endsOn: '2027-01-31' })).toBeNull();
    expect(brandProblem('Cafe X', '')).not.toBeNull();
    expect(brandProblem('Cafe X', 'Cafe')).toBeNull();
  });
});

describe('friendlyError', () => {
  it('keeps messages written for people and hides database internals', () => {
    expect(friendlyError({ message: 'You can be in up to 20 communities. Leave one to join another.' }, 'x')).toMatch(/20/);
    expect(friendlyError({ message: 'new row violates row-level security policy' }, 'Could not join.')).toBe('Could not join.');
    expect(friendlyError(null, 'fallback')).toBe('fallback');
  });
});
