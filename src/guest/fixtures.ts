// Made-up sample content for guest mode. Nothing here comes from a real
// member. Every account is marked "sample", every post says "(Sample post)",
// and the only external addresses are the public sample images below.
import type { Profile } from '../types';

export const GUEST_USER_ID = 'guest-demo-user';

// Public sample photos used by the seeded sample posts. They are fetched by
// address by the image component; no Supabase call is involved.
export const SAMPLE_IMAGE_BASE = 'https://xygkeodsjpaobnpjtkiz.supabase.co/storage/v1/object/public/post-images/';
// The sample listings' photos: free-licence Unsplash photos, linked, the same as the live samples.
export const SAMPLE_LISTING_IMAGE_BASE = 'https://images.unsplash.com/';

type Row = Record<string, unknown>;
export type FixtureTables = Record<string, Row[]>;

const day = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * day).toISOString();
const daysAhead = (n: number, hour = 18) => {
  const d = new Date(Date.now() + n * day);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

// First of next month, as the preference picker stores it.
function nextMonthStart(): string {
  const next = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
}

function profile(id: string, username: string, display_name: string, bio: string, university: string, interests: string[]): Profile {
  return {
    id, username, display_name, bio, avatar_url: null, cover_url: null, university,
    interests: interests as Profile['interests'], current_streak: 4, longest_streak: 9,
    last_active_date: null, has_completed_onboarding: true, is_admin: false, created_at: daysAgo(40),
  };
}

export const GUEST_PROFILE: Profile = {
  ...profile(GUEST_USER_ID, 'guest_demo', 'Guest', 'Looking around Havenly in demo mode.', 'Murdoch University Dubai', ['cafes', 'fitness', 'padel']),
  budget_aed: 3000, move_in_month: nextMonthStart(), housemate_pref: 'any', gender: null,
  current_streak: 3,
  longest_streak: 3,
};

// A stand-in session so screens that read `session.user.id` keep working. It
// has no token and is never sent to Supabase: the real client is not used while
// guest mode is on.
export const GUEST_SESSION = {
  access_token: '',
  refresh_token: '',
  expires_in: 0,
  token_type: 'bearer',
  user: { id: GUEST_USER_ID, email: undefined, app_metadata: {}, user_metadata: {}, aud: 'guest', created_at: daysAgo(1) },
} as unknown as import('@supabase/supabase-js').Session;

const maya = profile('sample-maya', 'samplemaya', 'Maya (sample)', 'Thrift runs and Friday coffee. Sample account.', 'American University in Dubai', ['fashion', 'cafes']);
const omar = profile('sample-omar', 'sampleomar', 'Omar (sample)', 'Padel on Thursdays. Sample account.', 'University of Wollongong in Dubai', ['padel', 'fitness']);
const jay = profile('sample-jay', 'samplejay', 'Jay (sample)', 'Open mic regular. Sample account.', 'Heriot-Watt University Dubai', ['events', 'art']);
const sara = profile('sample-sara', 'samplesara', 'Sara (sample)', 'Study spots and beach days. Sample account.', 'Murdoch University Dubai', ['study', 'beach']);

const profiles: Profile[] = [GUEST_PROFILE, maya, omar, jay, sara];

const post = (id: string, author: Profile, title: string, body: string, tag: string, location: string, image: string | null, likes: number, comments: number, ago: number, community_id: string | null = null): Row => ({
  id, author_id: author.id, title, body: `${body} (Sample post)`, image_url: image ? SAMPLE_IMAGE_BASE + image : null,
  video_url: null, tag, is_editorial: false, like_count: likes, comment_count: comments, created_at: daysAgo(ago),
  community_id, location,
});

const posts: Row[] = [
  post('post-vintage', maya, 'Vintage rails worth the dig', 'Racks of old denim, knitwear and a few proper blazers. Go early, bring patience, and check every pocket.', 'Fashion', 'Alserkal Avenue, Dubai', 'a0000000-0000-4000-8000-000000000001/vintage-store.jpg', 24, 3, 1, 'community-thrift'),
  post('post-gym', omar, 'New gym launch, membership open', 'Fresh equipment, big floor space and a student rate. Come see it this week.', 'Fitness', 'Dubai Knowledge Park, Dubai', 'a0000000-0000-4000-8000-000000000002/gym-launch.jpg', 18, 1, 2),
  post('post-padel', omar, 'Padel night this Thursday', 'Beginners welcome, rackets provided, free entry. Bring a friend and we will sort the teams.', 'Padel', 'Al Quoz, Dubai', 'a0000000-0000-4000-8000-000000000002/padel-night.jpg', 31, 2, 2, 'community-padel'),
  post('post-openmic', jay, 'Open mic night, every Friday', 'Coffee, a mic and whoever has something to share. Poetry, music, stand-up, anything goes. Sign up on the night.', 'Events', 'Alserkal Avenue, Dubai', 'a0000000-0000-4000-8000-000000000004/open-mic.jpg', 42, 4, 3),
  post('post-study', sara, 'Quiet study corner with real coffee', 'Plugs at every table, a good flat white and no one minds if you stay three hours.', 'Study Spots', 'Dubai Knowledge Park, Dubai', null, 15, 1, 4, 'community-study'),
  post('post-beach', sara, 'Sunset walk at Kite Beach', 'Go after 5 pm when it cools down. Bring water and a towel.', 'Beach Days', 'Kite Beach, Dubai', null, 22, 0, 5),
  post('post-cafe', maya, 'Best cortado near campus', 'Small place, no sign, ask for the cortado and a date loaf.', 'Cafes', 'Al Wasl, Dubai', null, 19, 2, 6, 'community-cafes'),
  post('post-football', omar, '5-a-side needs two more', 'Sunday 7 pm, bring a dark and a light shirt. All levels.', 'Football', 'Al Barsha, Dubai', null, 11, 1, 7, 'community-5aside'),
];

const comments: Row[] = [
  { id: 'comment-1', post_id: 'post-vintage', author_id: omar.id, body: 'Went last week, the denim rack is real. (Sample comment)', created_at: daysAgo(1) },
  { id: 'comment-2', post_id: 'post-vintage', author_id: sara.id, body: 'Is it cash only? (Sample comment)', created_at: daysAgo(1) },
  { id: 'comment-3', post_id: 'post-vintage', author_id: maya.id, body: 'Cards work now. (Sample comment)', created_at: daysAgo(0.5) },
  { id: 'comment-4', post_id: 'post-openmic', author_id: sara.id, body: 'Signing up this Friday. (Sample comment)', created_at: daysAgo(2) },
  { id: 'comment-5', post_id: 'post-padel', author_id: jay.id, body: 'Count me in. (Sample comment)', created_at: daysAgo(1) },
];

const community = (id: string, name: string, emoji: string, description: string, category: 'interest' | 'campus', interest: string | null, university: string | null, members: number): Row => ({
  id, name, emoji, description, category, related_interest: interest, related_university: university, member_count: members, created_at: daysAgo(60),
});

const communities: Row[] = [
  community('community-thrift', 'Thrift & Style', '🛍️', 'Second-hand finds, markets and outfit swaps.', 'interest', 'fashion', null, 128),
  community('community-padel', 'Padel Club', '🎾', 'Games, courts and beginner nights.', 'interest', 'padel', null, 214),
  community('community-cafes', 'Café Hoppers', '☕', 'Where to work, meet and drink good coffee.', 'interest', 'cafes', null, 187),
  community('community-study', 'Study Grind', '📚', 'Quiet corners, group sessions and exam season.', 'interest', 'study', null, 156),
  community('community-5aside', 'Dubai 5-a-Side', '⚽', 'Weekly games across the city.', 'interest', 'football', null, 98),
  community('community-beach', 'Beach Days', '🌊', 'Sunsets, volleyball and beach clean-ups.', 'interest', 'beach', null, 143),
  community('community-aus', 'American University in Dubai', '🎓', 'Everything for AUD students.', 'campus', null, 'American University in Dubai', 240),
  community('community-uowd', 'University of Wollongong in Dubai', '🎓', 'Everything for UOWD students.', 'campus', null, 'University of Wollongong in Dubai', 205),
  community('community-murdoch', 'Murdoch University Dubai', '🎓', 'Everything for Murdoch students.', 'campus', null, 'Murdoch University Dubai', 120),
  community('community-hw', 'Heriot-Watt University Dubai', '🎓', 'Everything for Heriot-Watt students.', 'campus', null, 'Heriot-Watt University Dubai', 133),
];

const event = (id: string, title: string, description: string, location: string, tag: string, inDays: number, hour: number, lat: number, lng: number): Row => ({
  id, title, description, location, tag, event_date: daysAhead(inDays, hour), created_at: daysAgo(5), latitude: lat, longitude: lng,
});

const events: Row[] = [
  event('event-padel', 'Padel night for beginners', 'Rackets provided, free entry. We sort the teams on the night. (Sample event)', 'Al Quoz, Dubai', 'Padel', 2, 16, 25.1366, 55.2253),
  event('event-openmic', 'Open mic at Alserkal', 'Poetry, music and stand-up. Sign up on the night. (Sample event)', 'Alserkal Avenue, Dubai', 'Events', 4, 17, 25.1425, 55.2269),
  event('event-market', 'Student thrift market', 'Bring what you do not wear, take what you do. (Sample event)', 'Dubai Knowledge Park, Dubai', 'Fashion', 6, 10, 25.1015, 55.1648),
  event('event-beach', 'Kite Beach sunset volleyball', 'Casual games, all levels. (Sample event)', 'Kite Beach, Dubai', 'Beach Days', 8, 14, 25.1605, 55.1946),
];

const room = (id: string, residence_id: string, name: string, price: number, period: string, occupancy: number, order: number): Row => ({
  id, residence_id, name, price_aed: price, billing_period: period, occupancy, is_available: true, sort_order: order, created_at: daysAgo(30),
});

// The same six labelled samples as the live app (scripts/sample-listings/seed.sql), so the demo and the
// live app look alike. Photos are linked from Unsplash (free licence); the demo never reads the database.
const residences: Row[] = [
  {
    id: 'residence-1', name: 'Sample Residence, Knowledge Park', provider_name: 'Sample Housing Partner', area: 'Dubai Knowledge Park',
    description: 'A student residence a short walk from the Knowledge Park campuses, with study rooms and a campus shuttle. Sample, not a real place: shown so you can see how Havenly works. Enquiries are off. Photos from Unsplash, for illustration only. (Sample listing)',
    address: 'Dubai Knowledge Park, Dubai', latitude: 25.1015, longitude: 55.1648,
    photo_urls: ['https://images.unsplash.com/photo-1524234599372-a5bd0194758d?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1652882860938-f90aa298e644?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1652882860902-7c6b0f88ef23?auto=format&fit=crop&w=1200&q=80'],
    amenities: ['Furnished', 'Bills included', 'Wi-Fi', 'Campus shuttle', 'Study rooms', 'Laundry', '24/7 security', 'Gym'], nearby_universities: ['Murdoch University Dubai', 'Middlesex University Dubai', 'Curtin University Dubai'],
    gender_policy: 'mixed', is_active: true, created_at: daysAgo(20), is_sample: true,
    listing_type: 'residence', bedrooms: null, deposit_aed: 3000, move_in_fee_aed: 500,
    is_verified: false, verified_at: null, permit_number: null,
    bills_included: true, bills_min_aed: null, bills_max_aed: null, student_deal_types: [], student_rate_aed: null, housemates: null,
    commutes: [{ university: 'Murdoch University Dubai', minutes: 8, mode: 'walk' }, { university: 'Middlesex University Dubai', minutes: 10, mode: 'walk' }, { university: 'Curtin University Dubai', minutes: 12, mode: 'shuttle' }],
  },
  {
    id: 'residence-2', name: 'Sample Shared Room, Academic City', provider_name: 'Sample Housing Partner', area: 'Dubai International Academic City',
    description: 'A bed in a twin room in a shared apartment near the Academic City campuses, the most affordable way to start. Sample, not a real place: shown so you can see how Havenly works. Enquiries are off. Photos from Unsplash, for illustration only. (Sample listing)',
    address: 'Dubai International Academic City, Dubai', latitude: 25.1214, longitude: 55.4146,
    photo_urls: ['https://images.unsplash.com/photo-1702014861736-d62834317c5e?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1665153515938-97aac6893f2c?auto=format&fit=crop&w=1200&q=80'],
    amenities: ['Furnished', 'Bills included', 'Wi-Fi', 'Shared kitchen', 'Campus shuttle'], nearby_universities: ['Heriot-Watt University Dubai', 'BITS Pilani Dubai', 'Amity University Dubai'],
    gender_policy: 'male_only', is_active: true, created_at: daysAgo(18), is_sample: true,
    listing_type: 'shared_room', bedrooms: null, deposit_aed: 750, move_in_fee_aed: null,
    is_verified: false, verified_at: null, permit_number: null,
    bills_included: true, bills_min_aed: null, bills_max_aed: null, student_deal_types: ['deposit_waived'], student_rate_aed: null, housemates: 3,
    commutes: [{ university: 'Heriot-Watt University Dubai', minutes: 7, mode: 'shuttle' }, { university: 'BITS Pilani Dubai', minutes: 10, mode: 'shuttle' }, { university: 'Amity University Dubai', minutes: 12, mode: 'shuttle' }],
  },
  {
    id: 'residence-3', name: 'Sample Rooms, Al Barsha', provider_name: 'Sample Housing Partner', area: 'Al Barsha',
    description: 'A private room in a calm shared apartment near the metro, with a shared kitchen and living room. Sample, not a real place: shown so you can see how Havenly works. Enquiries are off. Photos from Unsplash, for illustration only. (Sample listing)',
    address: 'Al Barsha, Dubai', latitude: 25.1124, longitude: 55.2007,
    photo_urls: ['https://images.unsplash.com/photo-1585128792103-0b591f96512e?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1582068019386-a943ee9287ae?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1619989652700-9984844cb0ea?auto=format&fit=crop&w=1200&q=80'],
    amenities: ['Furnished', 'Bills included', 'Wi-Fi', 'Shared kitchen', 'Laundry'], nearby_universities: ['American University in Dubai', 'University of Wollongong in Dubai'],
    gender_policy: 'female_only', is_active: true, created_at: daysAgo(15), is_sample: true,
    listing_type: 'private_room', bedrooms: null, deposit_aed: 1000, move_in_fee_aed: null,
    is_verified: false, verified_at: null, permit_number: null,
    bills_included: true, bills_min_aed: null, bills_max_aed: null, student_deal_types: [], student_rate_aed: null, housemates: 2,
    commutes: [{ university: 'American University in Dubai', minutes: 20, mode: 'metro' }, { university: 'University of Wollongong in Dubai', minutes: 25, mode: 'metro' }],
  },
  {
    id: 'residence-4', name: 'Sample Home, Jumeirah Lake Towers', provider_name: 'Sample Housing Partner', area: 'Jumeirah Lake Towers',
    description: 'A bright 3 bedroom home with a lake view, for friends who want to rent together and split the rent. Sample, not a real place: shown so you can see how Havenly works. Enquiries are off. Photos from Unsplash, for illustration only. (Sample listing)',
    address: 'Jumeirah Lake Towers, Dubai', latitude: 25.0657, longitude: 55.1413,
    photo_urls: ['https://images.unsplash.com/photo-1771287490603-fbf9b6211cc3?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1791882895717-554975aa5fb7?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1760611655728-f5f0279ed611?auto=format&fit=crop&w=1200&q=80'],
    amenities: ['Furnished', 'Wi-Fi', 'Gym', 'Pool', 'Parking', '24/7 security'], nearby_universities: ['Murdoch University Dubai', 'American University in Dubai'],
    gender_policy: 'mixed', is_active: true, created_at: daysAgo(12), is_sample: true,
    listing_type: 'home', bedrooms: 3, deposit_aed: 4500, move_in_fee_aed: null,
    is_verified: false, verified_at: null, permit_number: null,
    bills_included: false, bills_min_aed: 450, bills_max_aed: 700, student_deal_types: [], student_rate_aed: null, housemates: null,
    commutes: [{ university: 'Murdoch University Dubai', minutes: 22, mode: 'bus' }, { university: 'American University in Dubai', minutes: 18, mode: 'metro' }],
  },
  {
    id: 'residence-5', name: 'Sample Studios, Silicon Oasis', provider_name: 'Sample Housing Partner', area: 'Dubai Silicon Oasis',
    description: 'A compact furnished studio with its own kitchenette, close to the Academic City road. Sample, not a real place: shown so you can see how Havenly works. Enquiries are off. Photos from Unsplash, for illustration only. (Sample listing)',
    address: 'Dubai Silicon Oasis, Dubai', latitude: 25.1188, longitude: 55.379,
    photo_urls: ['https://images.unsplash.com/photo-1702014857653-dcea938d51f0?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1702014862053-946a122b920d?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1702014859908-d48b9b844240?auto=format&fit=crop&w=1200&q=80'],
    amenities: ['Furnished', 'Wi-Fi', 'Gym', 'Pool', 'Parking', '24/7 security'], nearby_universities: ['Rochester Institute of Technology Dubai', 'Manipal Academy of Higher Education Dubai'],
    gender_policy: 'mixed', is_active: true, created_at: daysAgo(10), is_sample: true,
    listing_type: 'studio', bedrooms: null, deposit_aed: 1800, move_in_fee_aed: 300,
    is_verified: false, verified_at: null, permit_number: null,
    bills_included: false, bills_min_aed: 350, bills_max_aed: 500, student_deal_types: ['student_rate'], student_rate_aed: 3300, housemates: 0,
    commutes: [{ university: 'Rochester Institute of Technology Dubai', minutes: 10, mode: 'bus' }, { university: 'Manipal Academy of Higher Education Dubai', minutes: 15, mode: 'taxi' }],
  },
  {
    id: 'residence-6', name: 'Sample 2 Bed, Dubai Marina', provider_name: 'Sample Housing Partner', area: 'Dubai Marina',
    description: 'A 2 bedroom apartment near the tram and the beach, good for two friends sharing. Sample, not a real place: shown so you can see how Havenly works. Enquiries are off. Photos from Unsplash, for illustration only. (Sample listing)',
    address: 'Dubai Marina, Dubai', latitude: 25.0805, longitude: 55.1403,
    photo_urls: ['https://images.unsplash.com/photo-1629032619752-594d21dfabd2?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1649429710616-dad56ce9a076?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1756154787365-c1a0b4dc4ed5?auto=format&fit=crop&w=1200&q=80'],
    amenities: ['Furnished', 'Wi-Fi', 'Gym', 'Pool', '24/7 security'], nearby_universities: ['American University in Dubai', 'University of Wollongong in Dubai'],
    gender_policy: 'mixed', is_active: true, created_at: daysAgo(8), is_sample: true,
    listing_type: 'home', bedrooms: 2, deposit_aed: 4000, move_in_fee_aed: null,
    is_verified: false, verified_at: null, permit_number: null,
    bills_included: false, bills_min_aed: 400, bills_max_aed: 600, student_deal_types: [], student_rate_aed: null, housemates: null,
    commutes: [{ university: 'American University in Dubai', minutes: 15, mode: 'metro' }, { university: 'University of Wollongong in Dubai', minutes: 20, mode: 'metro' }],
  },
];

const room_types: Row[] = [
  room('room-1a', 'residence-1', 'Private studio', 38000, 'year', 1, 1),
  room('room-1b', 'residence-1', 'Shared twin room', 24000, 'year', 2, 2),
  room('room-2a', 'residence-2', 'Bed in a twin room', 1500, 'month', 2, 1),
  room('room-3a', 'residence-3', 'Private room', 2800, 'month', 1, 1),
  room('room-4a', 'residence-4', 'Whole 3 bedroom home', 9000, 'month', 1, 1),
  room('room-5a', 'residence-5', 'Studio', 3600, 'month', 1, 1),
  room('room-6a', 'residence-6', 'Whole 2 bedroom home', 8500, 'month', 1, 1),
];

const brands: Row[] = [
  { id: 'brand-1', name: 'Sample Roastery', logo_url: null, category: 'Cafes', description: 'A made-up coffee brand for the demo.', contact_email: null, is_active: true, created_at: daysAgo(30) },
  { id: 'brand-2', name: 'Sample Fit Club', logo_url: null, category: 'Fitness', description: 'A made-up gym brand for the demo.', contact_email: null, is_active: true, created_at: daysAgo(30) },
  { id: 'brand-3', name: 'Sample Thrift Co', logo_url: null, category: 'Fashion', description: 'A made-up thrift shop for the demo.', contact_email: null, is_active: true, created_at: daysAgo(30) },
  { id: 'brand-4', name: 'Sample Padel House', logo_url: null, category: 'Padel', description: 'A made-up padel club for the demo.', contact_email: null, is_active: true, created_at: daysAgo(30) },
];

const offer = (id: string, brand_id: string, title: string, label: string, minStreak: number, lat: number, lng: number, address: string): Row => ({
  id, brand_id, title, description: 'A made-up perk for the demo. (Sample offer)', image_url: null, discount_label: label, min_streak: minStreak,
  starts_at: daysAgo(10), ends_at: null, is_active: true, created_at: daysAgo(10), latitude: lat, longitude: lng, address,
});

const offers: Row[] = [
  offer('offer-1', 'brand-1', '10% off any coffee', '10% off', 0, 25.1015, 55.1648, 'Dubai Knowledge Park, Dubai'),
  offer('offer-2', 'brand-2', 'Free day pass', 'Free pass', 3, 25.1366, 55.2253, 'Al Quoz, Dubai'),
  offer('offer-3', 'brand-3', '15% off vintage finds', '15% off', 5, 25.1425, 55.2269, 'Alserkal Avenue, Dubai'),
  offer('offer-4', 'brand-4', 'Court booking, second hour free', '2nd hour free', 7, 25.1366, 55.2253, 'Al Quoz, Dubai'),
];

// Tables the app reads that have nothing to show in the demo.
const empty = (): Row[] => [];

export function createFixtures(): FixtureTables {
  return {
    profiles: profiles as unknown as Row[],
    profile_private: [{ user_id: GUEST_USER_ID, budget_aed: 3000, move_in_month: nextMonthStart(), housemate_pref: 'any', gender: null }],
    posts, comments, communities, events, residences, room_types, brands, offers,
    community_members: [],
    follows: [],
    post_likes: [],
    saved_posts: [],
    saved_residences: [],
    conversations: empty(),
    conversation_reads: empty(),
    conversation_hidden_for: empty(),
    messages: empty(),
    // Two sample alerts. Already read, so opening the bell does not try to mark them (a blocked write).
    notifications: [
      { id: 'sample-alert-1', recipient_id: GUEST_USER_ID, actor_id: null, type: 'price_drop', residence_id: 'residence-2',
        old_price_aed: 1700, new_price_aed: 1500, post_id: null, comment_id: null, check_in_id: null, enquiry_id: null,
        enquiry_status: null, is_read: true, created_at: daysAgo(1) },
      { id: 'sample-alert-2', recipient_id: GUEST_USER_ID, actor_id: null, type: 'new_place', residence_id: 'residence-1',
        old_price_aed: null, new_price_aed: 2000, post_id: null, comment_id: null, check_in_id: null, enquiry_id: null,
        enquiry_status: null, is_read: true, created_at: daysAgo(2) },
    ],
    check_ins: empty(),
    interests: empty(),
    offer_claims: empty(),
    blocked_users: empty(),
    housing_enquiries: empty(),
    enquiry_groups: empty(),
    enquiry_group_members: empty(),
    residence_partner_terms: empty(),
  };
}

// Sample cards for the demo's housemate board (the demo never reaches the real database).
export const GUEST_HOUSEMATE_CARDS = [
  { user_id: 'sample-card-1', display_name: 'Nora', university: 'Murdoch University Dubai', gender: 'female', budget_aed: 2800, move_in_month: nextMonthStart(),
    area: 'Dubai Knowledge Park', lifestyle: ['quiet', 'non_smoker', 'studies_at_home'], note: 'Second-year business student. Looking for one or two calm housemates. Sample card.',
    residence_id: null, residence_name: null, spots_needed: null, updated_at: daysAgo(1) },
  { user_id: 'sample-card-2', display_name: 'Karim', university: 'Murdoch University Dubai', gender: 'male', budget_aed: 3200, move_in_month: nextMonthStart(),
    area: 'Jumeirah Lake Towers', lifestyle: ['night_owl', 'social', 'guests_ok'], note: 'Taking the 3 bedroom in JLT with a friend and need one more. Sample card.',
    residence_id: 'residence-4', residence_name: 'Sample Home, Jumeirah Lake Towers', spots_needed: 1, updated_at: daysAgo(2) },
];

// The demo's group enquiry: typing this code in "Join with a code" shows a sample group (joining stays blocked).
export const GUEST_GROUP_CODE = 'HAVEN2';
export const GUEST_GROUP_PREVIEW = {
  group_id: 'sample-group', residence_id: 'residence-4', residence_name: 'Sample Home, Jumeirah Lake Towers',
  organiser_name: 'Karim', members: 2, status: 'open',
};
