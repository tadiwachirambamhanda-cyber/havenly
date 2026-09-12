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
5. Create the editorial system account (needed before running the editorial
   posts migration, which looks it up by email):
   ```bash
   curl -X POST "https://<project-ref>.supabase.co/auth/v1/admin/users" \
     -H "apikey: <service_role_key>" -H "Authorization: Bearer <service_role_key>" \
     -H "Content-Type: application/json" \
     -d '{"email":"editorial@havenly.app","password":"<any-strong-random-string>","email_confirm":true}'
   ```
   Nobody ever logs in as this account — the password just needs to exist.
   `supabase/migrations/20260912160509_seed_editorial_posts.sql` finds it by
   email, sets its display name/bio, and attaches the editorial posts to it.
6. `npx expo start`

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
4. ~~Safety layer UI~~ — done: block (actually enforced via RLS + the
   `is_blocked_between()` function — hides posts, blocks new/existing
   conversations both ways) and report, with a `BlockedUsersScreen` to
   undo blocks
5. ~~Message requests vs. accepted DMs~~ — done: conversations start
   'pending', the recipient must accept before they can send anything
   (enforced in RLS, not just the UI); real unread tracking too
   (`conversation_reads`)
6. ~~Seed 30-40 real editorial posts~~ — done: 32 posts across all 10
   interest tags, attributed to a real "Havenly Editorial" system account
7. ~~True masonry feed layout~~ — done: manual two-column layout with
   deterministic per-post image heights + greedy column balancing
   (`FeedScreen.tsx`), replacing FlatList's equal-height-row numColumns
8. ~~Comments + a "Saved" bookmarks feature~~ — done: `comments` table
   (with a trigger keeping `posts.comment_count` in sync) and
   `saved_posts`, both respecting the blocking rules. PostDetail has a
   real comment thread + input bar and a working Save toggle; Profile's
   Saved tab shows real data and grid cells are tappable now.
