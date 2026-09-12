# Havenly

A Lemon8-style lifestyle community app for students & young adults in Dubai.

## Stack
- React Native + Expo (iOS + Android from one codebase)
- Supabase — Postgres, Auth, Storage, Realtime (powers DMs)
- React Navigation — bottom tabs + native stack

**Read PROJECT_BRIEF.md first** — it's the full concept doc, feature list,
design system, and build priority order in one place.

## Getting started
```bash
npm install
```
1. Create a Supabase project at supabase.com
2. Run `supabase/schema.sql` then `supabase/seed.sql` in the Supabase SQL editor
3. In Supabase → Authentication → Providers → Email, turn **off** "Confirm email"
   for the closed-beta phase (turn it back on before public launch)
4. Copy your Project URL + anon key into `app.json` → `expo.extra`
5. `npx expo start`

## Priority order
1. ~~Authentication (sign up/login/session)~~ — done: `src/lib/AuthContext.tsx`,
   `LoginScreen`, `SignUpScreen`; `RootNavigator` routes signed-out → auth,
   signed-in-not-onboarded → Onboarding, signed-in-onboarded → MainTabs
2. ~~Finish stubbed screens (Discover, Profile, PostDetail, CreatePost)~~ —
   done. Along the way also added `follows` (Profile stats + PostDetail
   Follow button), `toggle_post_like` RPC (Like actually persists and stays
   in sync now), and the `post-images` Storage bucket (real image upload in
   CreatePost). Comment and Save show a "coming soon" alert — no comments or
   bookmarks table exists yet, so those are genuinely not built, not faked.
3. ~~Load real fonts (Fraunces / Plus Jakarta Sans / JetBrains Mono)~~ — done
4. True masonry feed layout (currently equal-height columns via FlatList numColumns)
5. Safety layer UI (block/report — DB tables already exist)
6. Message requests vs. accepted DMs
7. Seed 30-40 real editorial posts before public launch
