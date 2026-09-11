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
2. Finish stubbed screens (Discover, Profile, PostDetail, CreatePost) using
   `havenly-app-prototype.html` as the exact visual spec
3. Load real fonts (Fraunces / Plus Jakarta Sans / JetBrains Mono)
4. True masonry feed layout
5. Safety layer UI (block/report — DB tables already exist)
6. Message requests vs. accepted DMs
7. Seed 30-40 real editorial posts before public launch
