import { supabase } from '@/lib/supabase';
import type { Brand, Comment, Community, HavenlyEvent, Offer, Post, ReportableType, ReportReason, ReviewItem } from '@/types';
import { isHiddenSampleBrand } from './community';
import { removePhotos } from './communityPhotos';

// Database calls for Community. Row security decides who sees what (hidden posts, blocked people,
// memberships); these functions only shape the requests.

export type Author = { display_name: string; avatar_url: string | null; university: string | null };

export interface FeedPost extends Omit<Post, 'author' | 'community'> {
  author: Author | null;
  community: { id: string; name: string } | null;
  residence: { id: string; name: string } | null;
  liked: boolean;
}

export interface FeedComment extends Omit<Comment, 'author'> { author: Author | null }

// Posts link to profiles twice (the author, and likes), so the author link is named.
const POST_SELECT =
  '*, author:profiles!posts_author_id_fkey(display_name, avatar_url, university), community:communities(id, name), residence:residences(id, name)';
const COMMENT_SELECT = '*, author:profiles(display_name, avatar_url, university)';

// ===== Communities =====

export async function fetchCommunities(): Promise<Community[]> {
  const { data, error } = await supabase.from('communities').select('*').order('name');
  if (error) throw error;
  return (data as Community[]) ?? [];
}

export async function fetchCommunity(id: string): Promise<Community | null> {
  const { data, error } = await supabase.from('communities').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Community | null) ?? null;
}

export async function fetchMyCommunityIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('community_members').select('community_id').eq('user_id', userId);
  if (error) throw error;
  return ((data as { community_id: string }[]) ?? []).map((r) => r.community_id);
}

export async function joinCommunity(userId: string, communityId: string): Promise<void> {
  const { error } = await supabase.from('community_members').insert({ community_id: communityId, user_id: userId });
  // Already a member: treat as joined.
  if (error && error.code !== '23505') throw error;
}

export async function leaveCommunity(userId: string, communityId: string): Promise<void> {
  const { error } = await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', userId);
  if (error) throw error;
}

// Posts in the last 7 days per community, for the "N new" line on the cards.
export async function fetchNewCounts(communityIds: string[]): Promise<Record<string, number>> {
  if (!communityIds.length) return {};
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('posts').select('community_id').in('community_id', communityIds).gte('created_at', since).is('hidden_at', null).limit(1000);
  if (error) return {};
  const out: Record<string, number> = {};
  for (const r of (data as { community_id: string }[]) ?? []) out[r.community_id] = (out[r.community_id] ?? 0) + 1;
  return out;
}

// ===== Posts =====

async function withLiked(userId: string | undefined, rows: Omit<FeedPost, 'liked'>[]): Promise<FeedPost[]> {
  if (!rows.length || !userId) return rows.map((r) => ({ ...r, liked: false }));
  const { data } = await supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', rows.map((r) => r.id));
  const liked = new Set(((data as { post_id: string }[]) ?? []).map((r) => r.post_id));
  return rows.map((r) => ({ ...r, author: r.author ?? null, community: r.community ?? null, residence: r.residence ?? null, liked: liked.has(r.id) }));
}

export async function fetchPosts(userId: string | undefined, communityIds: string[], limit = 30): Promise<FeedPost[]> {
  if (!communityIds.length) return [];
  const { data, error } = await supabase
    .from('posts').select(POST_SELECT).in('community_id', communityIds).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return withLiked(userId, (data as Omit<FeedPost, 'liked'>[]) ?? []);
}

export async function fetchPost(userId: string | undefined, postId: string): Promise<FeedPost | null> {
  const { data, error } = await supabase.from('posts').select(POST_SELECT).eq('id', postId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [row] = await withLiked(userId, [data as Omit<FeedPost, 'liked'>]);
  return row;
}

export async function createPost(input: {
  userId: string; communityId: string; body: string; imagePaths: string[]; area: string | null; residenceId: string | null;
}): Promise<string> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: input.userId,
      community_id: input.communityId,
      body: input.body.trim(),
      image_paths: input.imagePaths.length ? input.imagePaths : null,
      area: input.residenceId ? null : input.area,
      residence_id: input.residenceId,
      tag: 'community',
    })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deletePost(post: Pick<FeedPost, 'id' | 'image_paths'>): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', post.id);
  if (error) throw error;
  // The photos go with the post. A failure here only leaves files no one can open any more.
  if (post.image_paths?.length) await removePhotos(post.image_paths).catch(() => undefined);
}

export async function toggleLike(postId: string): Promise<{ liked: boolean; like_count: number }> {
  const { data, error } = await supabase.rpc('toggle_post_like', { post_id_input: postId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { liked: boolean; like_count: number };
}

// ===== Comments =====

export async function fetchComments(postIds: string[], perPost?: number): Promise<Record<string, FeedComment[]>> {
  if (!postIds.length) return {};
  const { data, error } = await supabase
    .from('comments').select(COMMENT_SELECT).in('post_id', postIds).order('created_at', { ascending: true }).limit(500);
  if (error) throw error;
  const out: Record<string, FeedComment[]> = {};
  for (const c of (data as FeedComment[]) ?? []) (out[c.post_id] ??= []).push({ ...c, author: c.author ?? null });
  if (perPost) for (const k of Object.keys(out)) out[k] = out[k].slice(-perPost);
  return out;
}

export async function addComment(userId: string, postId: string, body: string): Promise<FeedComment> {
  const { data, error } = await supabase
    .from('comments').insert({ post_id: postId, author_id: userId, body: body.trim() }).select(COMMENT_SELECT).single();
  if (error) throw error;
  return data as FeedComment;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  if (error) throw error;
}

// ===== Reports =====

export async function reportItem(type: ReportableType, id: string, reason: ReportReason): Promise<void> {
  const { error } = await supabase.rpc('report_item', { p_type: type, p_id: id, p_reason: reason });
  if (error) throw error;
}

export async function fetchReviewQueue(): Promise<ReviewItem[]> {
  const { data, error } = await supabase.rpc('review_queue');
  if (error) throw error;
  return (data as ReviewItem[]) ?? [];
}

export async function decideReport(type: ReportableType, id: string, decision: 'hide' | 'keep'): Promise<void> {
  const { error } = await supabase.rpc('decide_report', { p_type: type, p_id: id, p_decision: decision });
  if (error) throw error;
}

// ===== Events =====

export interface EventRow extends HavenlyEvent { community?: { id: string; name: string } | null }

const EVENT_SELECT = '*, community:communities(id, name)';

// Upcoming events, soonest first. With a community: that community's events and the app-wide ones.
export async function fetchUpcomingEvents(communityId?: string | null, limit = 30): Promise<EventRow[]> {
  let q = supabase.from('events').select(EVENT_SELECT).gte('event_date', new Date().toISOString()).is('hidden_at', null);
  if (communityId) q = q.or(`community_id.eq.${communityId},community_id.is.null`);
  const { data, error } = await q.order('event_date', { ascending: true }).limit(limit);
  if (error) throw error;
  return (data as EventRow[]) ?? [];
}

// For the team: everything, newest date first (row security shows them hidden ones too).
export async function fetchAllEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase.from('events').select(EVENT_SELECT).order('event_date', { ascending: false }).limit(200);
  if (error) throw error;
  return (data as EventRow[]) ?? [];
}

export async function fetchEvent(id: string): Promise<EventRow | null> {
  const { data, error } = await supabase.from('events').select(EVENT_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as EventRow | null) ?? null;
}

export async function fetchMyGoing(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('event_going').select('event_id').eq('user_id', userId);
  if (error) return new Set();
  return new Set(((data as { event_id: string }[]) ?? []).map((r) => r.event_id));
}

export async function setGoing(userId: string, eventId: string, going: boolean): Promise<void> {
  if (going) {
    const { error } = await supabase.from('event_going').insert({ event_id: eventId, user_id: userId });
    if (error && error.code !== '23505') throw error;
  } else {
    const { error } = await supabase.from('event_going').delete().eq('event_id', eventId).eq('user_id', userId);
    if (error) throw error;
  }
}

export interface EventSave {
  title: string; description: string | null; location: string; event_date: string; community_id: string | null;
}

export async function saveEvent(id: string | null, input: EventSave): Promise<void> {
  if (id) {
    const { error } = await supabase.from('events').update(input).eq('id', id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('events').insert({ ...input, tag: 'Community' });
    if (error) throw error;
  }
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}

// ===== Perks =====

export interface PerkRow extends Offer { brand: Brand }

function isLive(o: PerkRow, now: number): boolean {
  return o.is_active && !!o.brand?.is_active && new Date(o.starts_at).getTime() <= now && (!o.ends_at || new Date(o.ends_at).getTime() > now);
}

// Active perks for students. The old sample perks and the Veldemers brand are left out here.
export async function fetchPerks(): Promise<PerkRow[]> {
  const { data, error } = await supabase.from('offers').select('*, brand:brands(*)').eq('is_active', true).order('created_at', { ascending: false });
  if (error) throw error;
  const now = Date.now();
  return ((data as PerkRow[]) ?? []).filter((o) => o.brand && isLive(o, now) && !isHiddenSampleBrand(o.brand.name));
}

export async function fetchPerk(id: string): Promise<PerkRow | null> {
  const { data, error } = await supabase.from('offers').select('*, brand:brands(*)').eq('id', id).maybeSingle();
  if (error) throw error;
  const row = data as PerkRow | null;
  if (!row || !row.brand || isHiddenSampleBrand(row.brand.name)) return null;
  return row;
}

export async function fetchMyCodes(userId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('offer_claims').select('offer_id, code').eq('user_id', userId);
  if (error) return {};
  return Object.fromEntries(((data as { offer_id: string; code: string }[]) ?? []).map((r) => [r.offer_id, r.code]));
}

export async function claimPerk(offerId: string): Promise<string> {
  const { data, error } = await supabase.rpc('claim_offer', { offer_id_input: offerId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as { code: string }).code;
}

// For the team: every brand and perk, including switched-off ones.
export async function fetchAllBrands(): Promise<Brand[]> {
  const { data, error } = await supabase.from('brands').select('*').order('name');
  if (error) throw error;
  return (data as Brand[]) ?? [];
}

export async function fetchAllPerks(): Promise<PerkRow[]> {
  const { data, error } = await supabase.from('offers').select('*, brand:brands(*)').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as PerkRow[]) ?? [];
}

export async function createBrand(input: { name: string; category: string; description: string | null }): Promise<string> {
  const { data, error } = await supabase.from('brands').insert(input).select('id').single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function createPerk(input: {
  brand_id: string; title: string; discount_label: string; description: string | null; address: string | null; ends_at: string | null;
}): Promise<void> {
  const { error } = await supabase.from('offers').insert({ ...input, min_streak: 0, is_active: true });
  if (error) throw error;
}

export async function setPerkActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('offers').update({ is_active: active }).eq('id', id);
  if (error) throw error;
}

// ===== Listings (for tagging a post) =====

export async function fetchListingsForTag(): Promise<{ id: string; name: string; area: string }[]> {
  const { data, error } = await supabase.from('residences').select('id, name, area').eq('is_active', true).order('name').limit(300);
  if (error) throw error;
  return (data as { id: string; name: string; area: string }[]) ?? [];
}
