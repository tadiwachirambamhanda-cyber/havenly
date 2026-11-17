// Made-up sample content for guest mode. Nothing here comes from a real
// member. Every account is marked "sample", every post says "(Sample post)",
// and the only external addresses are the public sample images below.
import type { Profile } from '../types';

export const GUEST_USER_ID = 'guest-demo-user';

// Public sample photos used by the seeded sample posts. They are fetched by
// address by the image component; no Supabase call is involved.
export const SAMPLE_IMAGE_BASE = 'https://xygkeodsjpaobnpjtkiz.supabase.co/storage/v1/object/public/post-images/';

type Row = Record<string, unknown>;
export type FixtureTables = Record<string, Row[]>;

const day = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * day).toISOString();
const daysAhead = (n: number, hour = 18) => {
  const d = new Date(Date.now() + n * day);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

function profile(id: string, username: string, display_name: string, bio: string, university: string, interests: string[]): Profile {
  return {
    id, username, display_name, bio, avatar_url: null, cover_url: null, university,
    interests: interests as Profile['interests'], current_streak: 4, longest_streak: 9,
    last_active_date: null, has_completed_onboarding: true, is_admin: false, created_at: daysAgo(40),
  };
}

export const GUEST_PROFILE: Profile = {
  ...profile(GUEST_USER_ID, 'guest_demo', 'Guest', 'Looking around Havenly in demo mode.', 'Murdoch University Dubai', ['cafes', 'fitness', 'padel']),
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

const residences: Row[] = [
  {
    id: 'residence-1', name: 'Sample Residence, Knowledge Park', provider_name: 'Sample Housing Partner', area: 'Dubai Knowledge Park',
    description: 'A made-up student residence for the demo: furnished rooms, a study lounge and a short walk to campus. (Sample listing)',
    address: 'Dubai Knowledge Park, Dubai', latitude: 25.1015, longitude: 55.1648, photo_urls: [],
    amenities: ['Wi-Fi', 'Study lounge', 'Gym', 'Laundry'], nearby_universities: ['Murdoch University Dubai', 'Heriot-Watt University Dubai'],
    gender_policy: 'mixed', is_active: true, created_at: daysAgo(20),
    listing_type: 'residence', bedrooms: null, deposit_aed: null, move_in_fee_aed: null,
    is_verified: false, verified_at: null, permit_number: null,
  },
  {
    id: 'residence-2', name: 'Sample Residence, Academic City', provider_name: 'Sample Housing Partner', area: 'Dubai Academic City',
    description: 'A made-up student residence for the demo with shared kitchens and a rooftop. (Sample listing)',
    address: 'Dubai Academic City, Dubai', latitude: 25.1214, longitude: 55.4146, photo_urls: [],
    amenities: ['Wi-Fi', 'Shared kitchen', 'Rooftop', 'Bike storage'], nearby_universities: ['University of Wollongong in Dubai'],
    gender_policy: 'female_only', is_active: true, created_at: daysAgo(18),
    listing_type: 'residence', bedrooms: null, deposit_aed: null, move_in_fee_aed: null,
    is_verified: false, verified_at: null, permit_number: null,
  },
  {
    id: 'residence-3', name: 'Sample Residence, Al Barsha', provider_name: 'Sample Housing Partner', area: 'Al Barsha',
    description: 'A made-up student residence for the demo close to the metro. (Sample listing)',
    address: 'Al Barsha, Dubai', latitude: 25.1124, longitude: 55.2007, photo_urls: [],
    amenities: ['Wi-Fi', 'Metro nearby', 'Gym'], nearby_universities: ['American University in Dubai'],
    gender_policy: 'mixed', is_active: true, created_at: daysAgo(15),
    listing_type: 'residence', bedrooms: null, deposit_aed: null, move_in_fee_aed: null,
    is_verified: false, verified_at: null, permit_number: null,
  },
];

const room_types: Row[] = [
  room('room-1a', 'residence-1', 'Private studio', 38000, 'year', 1, 1),
  room('room-1b', 'residence-1', 'Shared twin room', 24000, 'year', 2, 2),
  room('room-2a', 'residence-2', 'Single room', 3200, 'month', 1, 1),
  room('room-2b', 'residence-2', 'Shared room', 2100, 'month', 2, 2),
  room('room-3a', 'residence-3', 'Private studio', 41000, 'year', 1, 1),
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
    notifications: empty(),
    check_ins: empty(),
    interests: empty(),
    offer_claims: empty(),
    blocked_users: empty(),
    housing_enquiries: empty(),
    residence_partner_terms: empty(),
  };
}
