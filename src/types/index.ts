export type Interest =
  | 'cafes' | 'fashion' | 'nightlife' | 'fitness' | 'beach'
  | 'study' | 'travel' | 'events' | 'padel' | 'beauty'
  | 'football' | 'running' | 'art' | 'gaming';

export interface Profile {
  id: string; username: string; display_name: string; bio: string | null;
  avatar_url: string | null; cover_url: string | null; university: string | null; interests: Interest[];
  current_streak: number; longest_streak: number; last_active_date: string | null;
  has_completed_onboarding: boolean; is_admin: boolean; created_at: string;
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
  status: ConversationStatus; initiator_id: string; is_group: boolean; name: string | null; icon_url: string | null;
}

export interface Message {
  id: string; conversation_id: string; sender_id: string; body: string; created_at: string;
  shared_post_id: string | null; shared_post?: Pick<Post, 'id' | 'title' | 'tag' | 'image_url' | 'video_url'> | null;
}

// Named HavenlyEvent, not Event, to avoid shadowing the DOM's global Event type.
export interface HavenlyEvent {
  id: string; title: string; description: string | null; location: string; tag: string;
  event_date: string; interested_count: number; created_at: string;
}

export type NotificationType = 'follow' | 'like' | 'comment';

export interface Notification {
  id: string; recipient_id: string; actor_id: string; actor?: Profile; type: NotificationType;
  post_id: string | null; post?: Pick<Post, 'id' | 'title' | 'image_url'> | null;
  comment_id: string | null; is_read: boolean; created_at: string;
}

export interface Brand {
  id: string; name: string; logo_url: string | null; category: string; description: string | null;
  contact_email: string | null; is_active: boolean; created_at: string;
}

export interface Offer {
  id: string; brand_id: string; brand?: Brand; title: string; description: string | null; image_url: string | null;
  discount_label: string; min_streak: number; starts_at: string; ends_at: string | null; is_active: boolean; created_at: string;
}

export interface OfferClaim {
  id: string; offer_id: string; user_id: string; code: string; claimed_at: string; redeemed_at: string | null;
}
