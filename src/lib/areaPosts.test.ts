import { describe, expect, it } from 'vitest';
import type { Post } from '../types';
import { answersLabel, fetchAreaPosts, initialAreaState, postByline, shapeAreaPosts, shortAgo, type AreaPostsClient } from './areaPosts';

function post(over: Partial<Post> = {}): Post {
  return {
    id: 'p1', author_id: 'u1', title: null, body: 'Anyone living in JLT? How long is the bus in the morning?', image_url: null,
    video_url: null, tag: 'general', is_editorial: false, like_count: 0, comment_count: 4, created_at: '2026-11-25T10:00:00Z',
    community_id: 'c1', location: null, area: 'Jumeirah Lake Towers', residence_id: null, hidden_at: null, ...over,
  };
}

function fakeClient(posts: unknown, authors: unknown, opts: { rpcError?: boolean; profilesError?: boolean } = {}) {
  const calls: { rpc?: unknown; ids?: string[] } = {};
  const client: AreaPostsClient = {
    rpc: (_fn, args) => { calls.rpc = args; return Promise.resolve({ data: opts.rpcError ? null : posts, error: opts.rpcError ? { message: 'x' } : null }); },
    from: () => ({
      select: () => ({
        in: (_c, ids) => { calls.ids = ids; return Promise.resolve({ data: opts.profilesError ? null : authors, error: opts.profilesError ? { message: 'x' } : null }); },
      }),
    }),
  };
  return { client, calls };
}

describe('area posts section state', () => {
  it('a signed-out visitor is invited to sign in, a demo guest is not, a student loads', () => {
    expect(initialAreaState({ signedIn: false, isGuest: false })).toEqual({ kind: 'signed_out' });
    expect(initialAreaState({ signedIn: true, isGuest: true })).toEqual({ kind: 'guest' });
    expect(initialAreaState({ signedIn: false, isGuest: true })).toEqual({ kind: 'guest' });
    expect(initialAreaState({ signedIn: true, isGuest: false })).toEqual({ kind: 'loading' });
  });
});

describe('shapeAreaPosts', () => {
  it('names the author and university, counts answers, keeps at most 3', () => {
    const posts = [post({ id: 'a' }), post({ id: 'b', author_id: 'u2', comment_count: 1 }), post({ id: 'c' }), post({ id: 'd' })];
    const out = shapeAreaPosts(posts, [{ id: 'u1', display_name: 'Sara', university: 'Sample University' }]);
    expect(out.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(out[0]).toMatchObject({ authorName: 'Sara', university: 'Sample University', answers: 4 });
    expect(out[1]).toMatchObject({ authorName: 'A student', university: null, answers: 1 });
  });

  it('drops hidden and empty posts', () => {
    const out = shapeAreaPosts([post({ id: 'h', hidden_at: '2026-11-25T00:00:00Z' }), post({ id: 'e', body: '  ' }), post({ id: 'ok' })], []);
    expect(out.map((p) => p.id)).toEqual(['ok']);
  });
});

describe('labels', () => {
  it('answers', () => {
    expect(answersLabel(0)).toBe('No answers yet');
    expect(answersLabel(1)).toBe('1 answer');
    expect(answersLabel(4)).toBe('4 answers');
  });

  it('short time', () => {
    const now = new Date('2026-11-25T12:00:00Z');
    expect(shortAgo('2026-11-25T11:59:40Z', now)).toBe('now');
    expect(shortAgo('2026-11-25T11:30:00Z', now)).toBe('30m');
    expect(shortAgo('2026-11-25T10:00:00Z', now)).toBe('2h');
    expect(shortAgo('2026-11-24T10:00:00Z', now)).toBe('1d');
    expect(shortAgo('2026-11-10T10:00:00Z', now)).toBe('2w');
    expect(shortAgo('not a date', now)).toBe('');
  });

  it('byline', () => {
    const [p] = shapeAreaPosts([post()], [{ id: 'u1', display_name: 'Sara', university: 'Sample University' }]);
    expect(postByline(p, new Date('2026-11-25T12:00:00Z'))).toBe('Sara · Sample University · 2h');
  });
});

describe('fetchAreaPosts', () => {
  it('asks for 3 posts for the listing and looks up each author once', async () => {
    const { client, calls } = fakeClient([post({ id: 'a' }), post({ id: 'b' })], [{ id: 'u1', display_name: 'Sara', university: null }]);
    const out = await fetchAreaPosts(client, 'res-1');
    expect(calls.rpc).toEqual({ p_residence: 'res-1', p_limit: 3 });
    expect(calls.ids).toEqual(['u1']);
    expect(out.map((p) => p.authorName)).toEqual(['Sara', 'Sara']);
  });

  it('with no posts, skips the author lookup', async () => {
    const { client, calls } = fakeClient([], []);
    expect(await fetchAreaPosts(client, 'res-1')).toEqual([]);
    expect(calls.ids).toBeUndefined();
  });

  it('throws when the posts call fails, so the screen shows its failed state', async () => {
    const { client } = fakeClient(null, [], { rpcError: true });
    await expect(fetchAreaPosts(client, 'res-1')).rejects.toBeTruthy();
  });

  it('still shows the posts when names fail to load', async () => {
    const { client } = fakeClient([post()], null, { profilesError: true });
    const out = await fetchAreaPosts(client, 'res-1');
    expect(out[0].authorName).toBe('A student');
  });
});
