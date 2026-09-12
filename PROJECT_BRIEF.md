# Havenly — Project Brief

A Lemon8-style lifestyle community app for students & young adults in Dubai.
This document is the single source of truth for what Havenly is, what's been
built, and what comes next. Read this first before touching any code.

---

## 1. Concept

Havenly is a visual-first lifestyle discovery and community app for students
and young adults living in or moving to Dubai. Think Lemon8's aesthetic,
card-based feed — but localized to Dubai, and extended with two things Lemon8
doesn't have: **interest-based communities** and **direct messaging**.

**Target user:** university students and young professionals (18-28) in
Dubai — many of them expats or new arrivals looking to find their people,
their café, and their community in a new city.

**Core problem it solves:** Dubai is a transient, highly international city.
Young people arrive constantly with no local network. Havenly gives them a
curated, visual way to discover the city (cafés, events, spots) *and* a way
to immediately plug into a community that matches their interests.

---

## 2. Core features

### Feed (Home)
- Two-column masonry grid of posts, Lemon8-style
- Mix of **user-generated content** and **editorial content** ("Havenly
  Picks" — gold-bordered cards with a badge), solving the cold-start problem
  where a new app has an empty, dead feed
- Tag pills to filter by category (Cafés, Fashion, Nightlife, Study Spots…)
- Tapping a card opens full Post Detail (image, caption, author, like/comment/save)

### Discover
- Search bar
- Horizontal-scroll "Trending spots" cards (cafés, padel clubs, beaches, art spaces)
- "This week on campus" — event listings with date, name, location
- Designed to eventually pull from Google Places API + Eventbrite API for live data

### Communities
- Two categories:
  - **Interest-based:** Padel Club, Café Hoppers, Thrift & Style, Study Grind
    — surfaced/sorted by the interests a user picked in onboarding
  - **Campus-based:** grouped by university (AUS, UOWD, etc.)
- Users can join/leave communities
- Community detail page shows member count and description
- See section 4 — faith/belief communities were considered and deliberately
  removed; don't reintroduce them without reading that section first

### Messages (DMs)
- TikTok/Instagram-style inbox: list of conversations with unread indicators
- Real-time chat threads (Supabase Realtime — messages appear instantly,
  no polling/refresh needed)
- **Not yet built, flagged as priority:** message requests vs. accepted DMs
  (to prevent spam/harassment — should gate messaging behind mutual follows
  or a request/accept flow before public launch), plus block/report UI
  (database tables already exist, see section 6)

### Profile
- Avatar, bio, university, stats (posts/followers/following)
- Interest chips (from onboarding)
- Posts / Saved / Tagged grid tabs

### Onboarding
- Interest-picker (chip-select UI): Cafés, Fashion, Nightlife, Fitness,
  Beach Days, Study Spots, Travel, Events, Padel, Beauty
- Selections save to the user's profile and drive feed personalization

---

## 3. Design identity

Deliberately avoids generic "AI app" defaults (cream+terracotta, or dark+neon).
Instead: golden-hour Dubai desert tones against a fresh coral/teal palette.

| Token | Value | Use |
|---|---|---|
| Sand (background) | `#FBF5EA` | Base background |
| Ink (text) | `#20261F` | Primary text |
| Coral (primary accent) | `#FF5A3C` | CTAs, active states |
| Teal (secondary accent) | `#0F8B82` | Tags, links |
| Gold (editorial accent) | `#E3A23A` | "Havenly Picks" badge/border |

**Typography:** Fraunces (serif, display/headlines) + Plus Jakarta Sans
(geometric sans, body) + JetBrains Mono (labels/tags/eyebrow text) — an
editorial-meets-playful pairing.

**Signature motif:** skyline-silhouette bottom nav bar (scalloped/notched
shape rather than a plain rectangle), desert dune wave dividers on onboarding.

Full visual reference: `havenly-app-prototype.html` — a single-file
clickable HTML prototype with every screen implemented. **Treat this as the
exact visual spec** when building out stubbed screens; don't reinvent layout
decisions already made there.

---

## 4. Decision log: faith & belief communities were removed

Havenly originally shipped with a third Communities category — faith/belief
groups (Muslim, Christian, Hindu, Jewish, Sikh, plus an open "Interfaith &
Spiritual" catch-all), each with a "Nearest places of worship" feature
pulling from a `worship_places` table. Every faith got identical visual and
functional treatment by design, specifically for Dubai's diverse,
multi-national student population — no faith was positioned as default or
higher-priority.

**That feature was deliberately removed** (not just deprioritized) as a
product decision: labeling users by religion inside a social app was judged
too much moderation/reputational risk for a small team to take on well,
especially pre-launch with no real content moderation infrastructure yet.
The `communities` category enum, `worship_places` table, and all related UI
were dropped in a migration rather than just hidden.

If faith-based communities come back later, revisit this section first —
the "equal treatment for every faith" principle above is still the right
bar to design against if it does.

---

## 5. Tech stack

- **React Native + Expo** — one codebase for iOS and Android, fast to ship
- **Supabase** — Postgres database, Auth, Storage (images), Realtime (DMs)
- **React Navigation** — bottom tabs (Feed, Discover, Inbox, Profile) + a
  native stack for detail screens (Post Detail, Chat, Community Detail,
  Create Post modal)

This combination was chosen specifically because it's the fastest realistic
path for a small team to hit a Q4 launch target — not because it's the only
valid choice.

---

## 6. What's actually built vs. what's left

**Fully wired to a real Supabase backend (not mocked):**
- Authentication → sign up/login/session persistence, routes new users
  through Onboarding once, returning users straight into the main app
- Onboarding → writes interests + `has_completed_onboarding` to `profiles`
- Feed → real query with editorial/UGC distinction, pull-to-refresh, refetches
  on focus so new posts/likes show up without a manual refresh
- Communities list + detail → join/leave persists to DB, interest-based sorting
- Discover → search bar + trending spots + weekly events (static mock content
  — designed to eventually pull from Google Places + Eventbrite APIs)
- Profile → real posts/followers/following stats, interest chips, Posts grid
  (Saved/Tagged tabs show an honest empty state — no bookmarks or tagging
  table exists yet)
- Post Detail → full action bar; Like is fully functional (`toggle_post_like`
  RPC keeps `post_likes` and `posts.like_count` in sync atomically), Follow
  works (`follows` table), Share uses the native share sheet; Comment and
  Save show a "coming soon" alert rather than fake data
- Create Post → real image upload to the `post-images` Storage bucket,
  topic-chip picker (reuses the onboarding interest vocabulary — this
  screen had no prototype spec to port, its prototype entry was just a
  placeholder alert)
- Inbox + Chat → real-time messaging via Supabase Realtime subscriptions
- Real brand fonts loaded (Fraunces / Plus Jakarta Sans / JetBrains Mono)
  and wired through `expo-font`; Feed/Discover/Profile image placeholders
  use real two-stop gradients via `expo-linear-gradient`

**Not started — build in this order:**
1. True masonry feed layout (currently equal-height columns, not variable)
2. **Safety layer UI**: block/report screens — database tables already exist
   (`blocked_users`, `reports`) with RLS policies, just need UI
3. Message requests vs. accepted DMs split (prevents spam/harassment)
4. Seed 30-40 real editorial posts before any public user sees the app —
   this is the entire point of the cold-start strategy, don't skip it
5. Comments + a bookmarks/"Saved" table — neither exists; PostDetail and
   Profile currently show honest placeholders instead of fake data for these

Database schema (`supabase/schema.sql`) already includes Row Level Security
policies on every table — this was built security-first, not bolted on later.

---

## 7. Monetization (not built, but designed for)

Two features already double as revenue mechanisms without needing new
architecture:

- **Sponsored editorial slots** — the existing `is_editorial` flag and
  "Havenly Picks" badge is exactly the placement local businesses (cafés,
  padel clubs, salons) would pay to appear in
- **Local business deals** — Discover's trending-spots section is a natural
  home for exclusive student discount codes tied to specific venues

Other paths considered but deliberately deferred until real active usage
exists: event ticketing commission, premium/community subscriptions,
in-feed native advertising. Building these into v1 would slow launch for
revenue that isn't reachable yet — the honest sequencing is: nail retention
first, monetize second.

---

## 8. Timeline context

Original goal: testable/launchable by end of year. Realistic path:
1. Auth + finish stubbed screens (this is the current phase)
2. Closed beta via TestFlight/Play Store internal testing with 20-50 real
   Dubai students (AUS, AUD, UOWD, Zayed Uni are natural first user pools)
3. Seed real editorial content based on beta feedback
4. Public launch with a content calendar already planned for month one

---

## 9. Files in this handoff

- `README.md` — setup instructions (npm install, Supabase connection steps)
- `havenly-app-prototype.html` — clickable visual reference, every screen
- `src/` — React Native source (screens, navigation, theme tokens, types)
- `supabase/schema.sql` — full database schema with RLS policies
- `supabase/seed.sql` — seed data for communities
- `app.json`, `package.json`, `tsconfig.json` — Expo project config

**First message to send in Claude Code:** something like *"Read
PROJECT_BRIEF.md and README.md, then start with the authentication flow as
outlined in the priority order."*
