import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isGuestMode } from '@/guest/guestState';
import { PHOTO_BUCKET, PHOTO_LINK_SECONDS, photoPath, photoSizeProblem, photoType } from './community';

// Community photos live only in the PRIVATE community-photos store (never the old public post-images store).
// A photo opens through a short-lived signed link, which the store gives only for your own photos or a post
// you can see, so a hidden post's photos stop opening for everyone else.

export interface PickedPhoto { uri: string; mimeType?: string | null; fileSize?: number | null }

export class PhotoProblem extends Error {}

// Uploads the photos into <user id>/ and returns their paths. If one fails, the ones already uploaded are removed.
export async function uploadPhotos(userId: string, photos: PickedPhoto[]): Promise<string[]> {
  const done: string[] = [];
  try {
    for (const p of photos) {
      const type = photoType(p.mimeType, p.uri);
      if (!type) throw new PhotoProblem('Photos must be JPEG, PNG, WebP or HEIC.');
      const sizeProblem = photoSizeProblem(p.fileSize);
      if (sizeProblem) throw new PhotoProblem(sizeProblem);
      const body = await fetch(p.uri).then((r) => r.arrayBuffer());
      const bytesProblem = photoSizeProblem(body.byteLength);
      if (bytesProblem) throw new PhotoProblem(bytesProblem);
      const path = photoPath(userId, type.ext, Date.now(), Math.random().toString(36).slice(2));
      const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, body, { contentType: type.contentType, upsert: false });
      if (error) throw error;
      done.push(path);
    }
    return done;
  } catch (e) {
    if (done.length) await removePhotos(done).catch(() => undefined);
    throw e;
  }
}

export async function removePhotos(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
  if (error) throw error;
}

// Signed links, kept until shortly before they run out.
const cache = new Map<string, { url: string; until: number }>();

async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const p of paths) {
    const hit = cache.get(p);
    if (hit && hit.until > now) out[p] = hit.url;
    else missing.push(p);
  }
  if (missing.length) {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(missing, PHOTO_LINK_SECONDS);
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.path && row.signedUrl && !row.error) {
        out[row.path] = row.signedUrl;
        cache.set(row.path, { url: row.signedUrl, until: now + (PHOTO_LINK_SECONDS - 300) * 1000 });
      }
    }
  }
  return out;
}

// Forget links for a post that has gone (deleted, hidden, blocked), so they are not reused.
export function forgetPhotoLinks(paths: string[] | null | undefined): void {
  for (const p of paths ?? []) cache.delete(p);
}

// The links for a post's photos: undefined while loading, then a map (a missing path did not open).
export function usePhotoLinks(paths: string[] | null | undefined): Record<string, string> | undefined | 'failed' {
  const key = (paths ?? []).join('|');
  const [state, setState] = useState<{ key: string; urls: Record<string, string> | 'failed' } | null>(null);
  useEffect(() => {
    if (!key) return;
    // The demo has no private photos and its client refuses signed links.
    if (isGuestMode()) { setState({ key, urls: {} }); return; }
    let alive = true;
    signedUrls(key.split('|'))
      .then((urls) => { if (alive) setState({ key, urls }); })
      .catch(() => { if (alive) setState({ key, urls: 'failed' }); });
    return () => { alive = false; };
  }, [key]);
  if (!key) return {};
  return state && state.key === key ? state.urls : undefined;
}
