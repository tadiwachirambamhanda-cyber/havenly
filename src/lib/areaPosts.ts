// "Students talking about this area" on a listing page (F20): the posts tagged with the listing
// or its area, from area_posts(p_residence, p_limit). No React Native imports, so the shaping
// and the section state run in the unit tests; the client is passed in.
import type { Post } from '../types';

export const AREA_POST_LIMIT = 3;

export interface AreaPost {
  id: string;
  authorName: string;
  university: string | null;
  body: string;
  answers: number;
  createdAt: string;
}

// What the section shows. A demo guest never calls the database for this: guest mode runs on
// bundled content only, and there are no sample area posts.
export type AreaPostsState =
  | { kind: 'signed_out' }
  | { kind: 'guest' }
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'posts'; posts: AreaPost[] };

export function initialAreaState(opts: { signedIn: boolean; isGuest: boolean }): AreaPostsState {
  if (opts.isGuest) return { kind: 'guest' };
  if (!opts.signedIn) return { kind: 'signed_out' };
  return { kind: 'loading' };
}

type AuthorRow = { id: string; display_name: string | null; username?: string | null; university: string | null };

export function shapeAreaPosts(posts: readonly Post[], authors: readonly AuthorRow[], limit = AREA_POST_LIMIT): AreaPost[] {
  const byId = new Map(authors.map((a) => [a.id, a]));
  return posts
    .filter((p) => !p.hidden_at && (p.body ?? p.title ?? '').trim() !== '')
    .slice(0, limit)
    .map((p) => {
      const a = byId.get(p.author_id);
      const name = a?.display_name?.trim() || a?.username?.trim() || 'A student';
      return {
        id: p.id,
        authorName: name,
        university: a?.university?.trim() || null,
        body: (p.body ?? p.title ?? '').trim(),
        answers: Math.max(0, p.comment_count ?? 0),
        createdAt: p.created_at,
      };
    });
}

export function answersLabel(n: number): string {
  if (n <= 0) return 'No answers yet';
  return n === 1 ? '1 answer' : `${n} answers`;
}

// "now", "5m", "2h", "1d", "3w": the short time on a post card.
export function shortAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(0, Math.floor((now.getTime() - then) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

// "Sara · Murdoch University Dubai · 2h"
export function postByline(p: AreaPost, now?: Date): string {
  return [p.authorName, p.university, shortAgo(p.createdAt, now)].filter(Boolean).join(' · ');
}

// The smallest slice of the Supabase client this needs, so a test can pass a fake.
export interface AreaPostsClient {
  rpc: (fn: 'area_posts', args: { p_residence: string; p_limit: number }) => PromiseLike<{ data: unknown; error: unknown }>;
  from: (table: 'profiles') => {
    select: (cols: string) => { in: (col: string, values: string[]) => PromiseLike<{ data: unknown; error: unknown }> };
  };
}

export async function fetchAreaPosts(client: AreaPostsClient, residenceId: string): Promise<AreaPost[]> {
  const { data, error } = await client.rpc('area_posts', { p_residence: residenceId, p_limit: AREA_POST_LIMIT });
  if (error) throw error;
  const posts = (Array.isArray(data) ? data : []) as Post[];
  const ids = [...new Set(posts.map((p) => p.author_id).filter(Boolean))];
  let authors: AuthorRow[] = [];
  if (ids.length) {
    const res = await client.from('profiles').select('id, display_name, username, university').in('id', ids);
    // Names are a nicety: if they fail to load, the posts still show as "A student".
    if (!res.error && Array.isArray(res.data)) authors = res.data as AuthorRow[];
  }
  return shapeAreaPosts(posts, authors);
}
