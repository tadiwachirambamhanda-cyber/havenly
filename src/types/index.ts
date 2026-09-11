export type Interest =
  | 'cafes' | 'fashion' | 'nightlife' | 'fitness' | 'beach'
  | 'study' | 'travel' | 'events' | 'padel' | 'beauty';

export interface Profile {
  id: string; username: string; display_name: string; bio: string | null;
  avatar_url: string | null; university: string | null; interests: Interest[];
  has_completed_onboarding: boolean; created_at: string;
}

export interface Post {
  id: string; author_id: string; author?: Profile; title: string; body: string | null;
  image_url: string | null; tag: string; is_editorial: boolean; like_count: number; created_at: string;
}

export type CommunityCategory = 'interest' | 'faith' | 'campus';
export type WorshipType = 'mosque' | 'church' | 'temple' | 'synagogue' | 'gurdwara' | 'general';

export interface Community {
  id: string; name: string; emoji: string; description: string; category: CommunityCategory;
  worship_type: WorshipType | null; member_count: number; created_at: string;
}

export interface WorshipPlace {
  id: string; worship_type: WorshipType; name: string; area: string; latitude: number; longitude: number;
}

export interface Conversation {
  id: string; participant_ids: string[]; last_message: string | null; last_message_at: string | null;
}

export interface Message {
  id: string; conversation_id: string; sender_id: string; body: string; created_at: string;
}
