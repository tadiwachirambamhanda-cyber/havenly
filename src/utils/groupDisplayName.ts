import type { Conversation, Profile } from '@/types';

// Falls back to a comma list of first names when a group has no name set,
// trimmed so it doesn't run on forever for a big group.
export function groupDisplayName(conversation: Pick<Conversation, 'name'>, members: Profile[]): string {
  if (conversation.name) return conversation.name;
  const names = members.map((m) => m.display_name.split(' ')[0]);
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} & ${names.length - 3} more`;
}
