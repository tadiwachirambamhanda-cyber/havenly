export type Interest =
  | 'cafes' | 'fashion' | 'nightlife' | 'fitness' | 'beach'
  | 'study' | 'travel' | 'events' | 'padel' | 'beauty'
  | 'football' | 'running' | 'art' | 'gaming';

export interface Profile {
  id: string; username: string; display_name: string; bio: string | null;
  avatar_url: string | null; cover_url: string | null; university: string | null; interests: Interest[];
  current_streak: number; longest_streak: number; last_active_date: string | null;
  has_completed_onboarding: boolean; is_admin: boolean; created_at: string;
  // Private fields (table profile_private): only present on your own profile, never on other students'.
  budget_aed?: number | null; move_in_month?: string | null; housemate_pref?: 'any' | 'female_only' | 'male_only' | null;
  gender?: 'female' | 'male' | null;
}

export interface Post {
  id: string; author_id: string; author?: Profile; title: string; body: string | null;
  image_url: string | null; video_url: string | null; tag: string; is_editorial: boolean; like_count: number;
  comment_count: number; created_at: string; community_id: string | null; location: string | null; community?: { name: string } | null;
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
  event_date: string; created_at: string;
  latitude: number | null; longitude: number | null;
}

export type NotificationType = 'follow' | 'like' | 'comment' | 'ping' | 'enquiry_new' | 'enquiry_status';

export interface Notification {
  id: string; recipient_id: string; actor_id: string; actor?: Profile; type: NotificationType;
  post_id: string | null; post?: Pick<Post, 'id' | 'title' | 'image_url'> | null;
  comment_id: string | null;
  check_in_id: string | null; check_in?: Pick<CheckIn, 'id' | 'place_type' | 'place_id'> | null;
  enquiry_id: string | null; enquiry_status: EnquiryStatus | null;
  enquiry?: { id: string; kind: EnquiryKind; residence: { id: string; name: string } | null } | null;
  is_read: boolean; created_at: string;
}

export interface Brand {
  id: string; name: string; logo_url: string | null; category: string; description: string | null;
  contact_email: string | null; is_active: boolean; created_at: string;
}

export interface Offer {
  id: string; brand_id: string; brand?: Brand; title: string; description: string | null; image_url: string | null;
  discount_label: string; min_streak: number; starts_at: string; ends_at: string | null; is_active: boolean; created_at: string;
  latitude: number | null; longitude: number | null; address: string | null;
}

export interface OfferClaim {
  id: string; offer_id: string; user_id: string; code: string; claimed_at: string; redeemed_at: string | null;
}

export type CheckInPlaceType = 'offer' | 'event';

export interface CheckIn {
  id: string; user_id: string; user?: Profile; place_type: CheckInPlaceType; place_id: string;
  created_at: string; expires_at: string;
}

// A forward-looking "I'm down to go" — same place_type/place_id shape as
// CheckIn, but no expiry: it's a standing signal, not a live location.
// Named PlaceInterest since `Interest` already means a profile topic tag.
export interface PlaceInterest {
  id: string; user_id: string; user?: Profile; place_type: CheckInPlaceType; place_id: string;
  created_at: string;
}

export type BillingPeriod = 'year' | 'semester' | 'month';
export type GenderPolicy = 'mixed' | 'female_only' | 'male_only';
export type ListingType = 'residence' | 'shared_room' | 'private_room' | 'studio' | 'home';
export type StudentDealType = 'student_rate' | 'deposit_waived' | 'fees_waived' | 'free_first_month' | 'group_discount';
export type CommuteMode = 'bus' | 'metro' | 'walk' | 'taxi' | 'shuttle';
export interface ResidenceCommute { university: string; minutes: number; mode: CommuteMode }

export interface RoomType {
  id: string; residence_id: string; name: string; price_aed: number; billing_period: BillingPeriod;
  occupancy: number; is_available: boolean; sort_order: number; created_at: string;
}

export interface Residence {
  id: string; name: string; provider_name: string; description: string | null; area: string; address: string | null;
  latitude: number | null; longitude: number | null; photo_urls: string[]; amenities: string[];
  nearby_universities: string[]; gender_policy: GenderPolicy; is_active: boolean; created_at: string;
  listing_type: ListingType; bedrooms: number | null; deposit_aed: number | null; move_in_fee_aed: number | null;
  is_verified: boolean; verified_at: string | null; permit_number: string | null;
  bills_included: boolean | null; bills_min_aed: number | null; bills_max_aed: number | null;
  // student_rate_aed is a discounted rent per month.
  student_deal_types: StudentDealType[]; student_rate_aed: number | null; housemates: number | null;
  commutes: ResidenceCommute[];
  room_types?: RoomType[];
}

export interface ResidencePartnerTerms {
  residence_id: string; referral_fee_percent: number; contact_name: string | null; contact_email: string | null;
  contact_phone: string | null; notes: string | null; updated_at: string;
}

export type EnquiryKind = 'question' | 'viewing';
export type EnquiryStatus = 'new' | 'contacted' | 'viewing_booked' | 'signed' | 'lost';

export interface HousingEnquiry {
  id: string; user_id: string | null; user?: Pick<Profile, 'id' | 'display_name' | 'username' | 'avatar_url' | 'university'> | null;
  residence_id: string; residence?: Pick<Residence, 'id' | 'name' | 'area' | 'photo_urls' | 'provider_name'>;
  room_type_id: string | null; room_type?: Pick<RoomType, 'id' | 'name' | 'price_aed' | 'billing_period'> | null;
  kind: EnquiryKind; move_in_month: string; duration_months: number; budget_aed: number | null;
  contact_phone: string | null; message: string | null; preferred_viewing: string | null; status: EnquiryStatus;
  contract_value_aed: number | null; referral_fee_aed: number | null; fee_paid_at: string | null;
  status_updated_at: string; created_at: string;
}
