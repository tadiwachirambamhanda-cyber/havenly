# PRD: Havenly v2, student housing and student community in Dubai

For: Havenly (founder-run, pre-launch, Dubai). Written: 2026-11-25 (replaces the housing-first PRD of 2026-11-18). Source: the founder's own decisions in conversation on 2026-11-25 ("a lane that will handle the social community side of the app as previously before but only the features we need … a vibrant look and redesign that will fit both functions of the app, so our app will tackle 2 birds with 1 stone"), and the housing v1 already built (F1 to F13).

## The client

Havenly is the founder's own product: a small, pre-launch team with a working app (web live on Vercel, phone through Expo Go). Housing v1 is built: listings, search, enquiries and group enquiries, saved places, alerts, the housemates board, the renting guide and the team's tools. The social features (feed, communities, events, perks) were removed on 2026-11-18 and are kept at git tag `archive/social-v1`; their database tables still exist.

## The problem

Students who move to Dubai for university hunt for a place across Property Finder, Bayut, Facebook and WhatsApp groups and agents, and the real answers ("is this area safe at night?", "how long is the bus to Academic City?", "anyone need a flatmate?") live in those groups, not on the listing sites. Havenly fixes the listing side. v2 brings the student conversation into the same app, so students come back between house hunts and the community answers their housing questions.

## Who uses it

- **Student (searching):** 18 to 28, at a Dubai university, often new to the city. Wants a safe, affordable place near campus, and other students to ask.
- **Student (in the community):** any signed-in student. Joins university communities, posts, asks about areas, finds events, perks and housemates.
- **Havenly team (admin):** adds listings, answers enquiries, tracks referral fees, adds events and perks, and reviews reported posts.
- **Housing provider (not a user yet):** pays a referral fee per signed student; signs the contract offline.

## What it must do

1. Housing stays the first screen and the main reason to open the app. Tabs become Housing, Community, Saved, Inbox, Profile.
2. One new, vibrant look that fits both housing and community, designed first and approved by the founder (Housing home and Community) before any screen is rebuilt.
3. University communities: any signed-in student can join and read any community; every post shows the poster's university. Signed-out visitors can browse listings as today.
4. Posts live inside communities only: photos and text, likes and comments. No global feed of people you follow.
5. Area questions: a post can be tagged with an area or a listing; the listing page shows "Students talking about this area".
6. The housemates board moves into Community, with its matching rules unchanged.
7. Events and student perks come back inside Community.
8. Anyone can report a post, comment or event; the team has a review queue to hide or keep it.
9. Housing gets simpler: demo mode, the in-app Map and Compare are removed; the rent split shows on the listing page instead of its own sheet; search shows search, price, kind of place and who it is for up front, with the rest under "More filters".
10. Everything else in housing stays: listings, Verified, enquiries and group enquiry, Saved, alerts, renting guide, messages and team tools.

## How the client will judge it

- "I open the app and land on housing, and Community is one tap away."
- "The app looks alive, not like a property portal, and housing and community clearly belong to one app."
- "I post 'anyone living in JLT, how is the commute?' in my university's community, and it shows on JLT listings."
- "A friend from another university can read and answer in my community, and I can see where they study."
- "Something nasty gets reported and the team can hide it the same day."

## Constraints

- Platforms: web (Vercel, redeploys on every merge) and phone through Expo Go (SDK 58).
- Supabase free tier (pauses when idle; the founder has two free projects at most).
- English only. AED.
- Listings must be real; nothing invented. Community content is real students' content: no seeded fake posts presented as real.
- Anything students post must be reportable and removable before public launch (app store rule for user content).
- Pre-launch to-dos still stand: domain and business email, legal entity, lawyer review of the privacy policy and terms (now also community rules), public policy URL.

## Not in this version

- A global feed, following people, follower lists, other people's post grids.
- Video posts.
- Check-ins, pings and activity streaks.
- Sharing posts into chats.
- Push notifications (needs a development build).
- Demo mode, the in-app Map screen and Compare (removed in this version).
- Everything already out of scope for housing: payments and contracts in the app, agents listing their own places, reviews and ratings of places, Arabic.

## Data

- Existing tables reused: `communities`, `community_members`, `posts`, `comments`, `post_likes`, `events`, `brands`, `offers`, `offer_claims`, reports and blocks. Their policies were written for the old app and must be re-checked before use (for example, campus communities were restricted to their own students; now anyone may join).
- New: a post's area or listing tag; a team review state on reported content.
- Personal data stays limited: a post shows display name, photo and university only. No real people in test data or seeds.

## Open questions

1. **Decided 2026-11-25:** only the team creates events; students browse and tap Going.
2. **Decided 2026-11-25:** a student taps "Get code" and gets a personal code to show at the shop; one claim per perk per student. No streaks.
3. **Moderation:** decided 2026-11-25 that a post or comment reported by 3 different students hides itself until the team reviews it. Still open: who on the team reviews, how fast, and the written community rules.
4. **Signed-out visitors:** may they read communities, or only listings? (This PRD assumes listings only; reading Community needs an account.)
5. **Notifications:** should students be told when someone comments on or likes their post? (Not in v2 unless decided.)
6. **Which communities exist at launch:** one per university already in the app, plus a few interest groups? Who creates new ones (team only, assumed)?
7. **UAE rules for user posts:** what the community rules and terms must say (lawyer).
8. **Decided 2026-11-25:** keep the logo (roof-h mark and wordmark); it takes the new main colour. Colour direction: evolve the oxblood into a brighter berry red, with mint for community (likes, Going) and sun yellow for deals and perks, on warm off-white (light) and near-black (dark). The founder approves the exact palette on the first two designs.
