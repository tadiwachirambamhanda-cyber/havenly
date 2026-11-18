// What a chat bubble says. A message that shared a post (the feed is archived, git tag
// archive/social-v1) shows a plain line and never tries to open the post.
export function chatBubbleText(m: { body: string; shared_post_id?: string | null }): string {
  return m.shared_post_id ? 'Shared a post (no longer available)' : m.body;
}
