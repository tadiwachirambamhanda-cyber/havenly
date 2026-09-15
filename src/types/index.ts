export type Interest =
  | 'cafes' | 'fashion' | 'nightlife' | 'fitness' | 'beach'
  | 'study' | 'travel' | 'events' | 'padel' | 'beauty'
  | 'football' | 'running' | 'art' | 'gaming';

export interface Profile {
  id: string; username: string; display_name: string; bio: string | null;
  avatar_url: string | null; university: string | null; interests: Interest[];
  has_completed_onboarding: boolean; created_at: string;
}

export interface Post {
  id: string; author_id: string; author?: Profile; title: string; body: string | null;
  image_url: string | null; video_url: string | null; tag: string; is_editorial: boolean; like_count: number;
  comment_count: number; created_at: string; community_id: string | null; community?: { name: string } | null;
}

export interface Comment {
  id: string; post_id: string; author_id: string; author?: Profile; body: string; created_at: string;
}

export type CommunityCategory = 'interest' | 'campus';

export interface Community {
  id: string; name: string; emoji: string; description: string; category: CommunityCategory;
  related_interest: Interest | null; related_university: string | null; member_count: number; created_at: string;
}

export type ConversationStatus = 'pending' | 'accepted' | 'declined';

export interface Conversation {
  id: string; participant_ids: string[]; last_message: string | null; last_message_at: string | null;
  status: ConversationStatus; initiator_id: string;
}

export interface Message {
  id: string; conversation_id: string; sender_id: string; body: string; created_at: string;
}

// Named HavenlyEvent, not Event, to avoid shadowing the DOM's global Event type.
export interface HavenlyEvent {
  id: string; title: string; description: string | null; location: string; tag: string;
  event_date: string; interested_count: number; created_at: string;
}
