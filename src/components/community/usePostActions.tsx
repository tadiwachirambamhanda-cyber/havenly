import { useCallback, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { friendlyError } from '@/lib/community';
import { deletePost, toggleLike, type FeedPost } from '@/lib/communityApi';
import { forgetPhotoLinks } from '@/lib/communityPhotos';
import { useSafetyMenu } from './SafetyMenu';

// Like, delete, report and block for a list of posts. The screen owns the list; this keeps it in step.
export function usePostActions(
  setPosts: (update: (prev: FeedPost[]) => FeedPost[]) => void,
  { onDeleted, onBlocked }: { onDeleted?: (post: FeedPost) => void; onBlocked?: (userId: string) => void } = {},
) {
  const { session } = useAuth();
  const myId = session?.user.id;
  const { showToast } = useToast();
  const busy = useRef(new Set<string>());

  const safety = useSafetyMenu({
    onBlocked: (userId) => {
      setPosts((prev) => prev.filter((p) => {
        if (p.author_id === userId) forgetPhotoLinks(p.image_paths);
        return p.author_id !== userId;
      }));
      onBlocked?.(userId);
    },
  });

  const onLike = useCallback(async (post: FeedPost) => {
    if (busy.current.has(post.id)) return;
    busy.current.add(post.id);
    haptics.tap();
    const flip = (p: FeedPost, liked: boolean, count: number) => (p.id === post.id ? { ...p, liked, like_count: count } : p);
    setPosts((prev) => prev.map((p) => flip(p, !post.liked, Math.max(0, (post.like_count ?? 0) + (post.liked ? -1 : 1)))));
    try {
      const r = await toggleLike(post.id);
      setPosts((prev) => prev.map((p) => flip(p, r.liked, r.like_count)));
    } catch (e) {
      setPosts((prev) => prev.map((p) => flip(p, post.liked, post.like_count)));
      showToast(friendlyError(e, 'Couldn’t update the like. Try again.'), 'error');
    } finally {
      busy.current.delete(post.id);
    }
  }, [setPosts, showToast]);

  const onMenu = useCallback((post: FeedPost) => {
    safety.open({
      type: 'post',
      id: post.id,
      authorId: post.author_id,
      authorName: post.author?.display_name ?? null,
      onDelete: post.author_id === myId ? async () => {
        await deletePost(post);
        forgetPhotoLinks(post.image_paths);
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        onDeleted?.(post);
      } : undefined,
    });
  }, [safety, myId, setPosts, onDeleted]);

  return { onLike, onMenu, openMenu: safety.open, menus: safety.element, myId };
}
