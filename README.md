# Havenly

A pre-launch app that brings student housing and student community together in one place, in Dubai. Built with AI coding agents (Claude Code, Codex).

**Web app:** https://havenly-app-zeta.vercel.app

## What it does
- **Housing:** listings, search and filters, individual and group enquiries, saved places, alerts, rent splitting and a Dubai renting guide.
- **Community:** university communities, photo posts, area questions that connect to listings, a housemates board, events, student perks and messaging.
- **Safety:** post reporting, blocking and a team review queue.

Note: `app.json` holds the Supabase **anon** key and a Mapbox **public** token. Both are meant to ship inside the app; data access is protected by row-level security, never by hiding these keys.

## Stack
- React Native, Expo and TypeScript (iOS, Android and web from one codebase)
- Supabase: Postgres, Auth, Storage, Realtime
- React Navigation

**Read `docs/prd.md` and `docs/feature-list.md` first.** `PROJECT_BRIEF.md` describes the earlier social-app version and is partly out of date.

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
6. Grant yourself (or whoever should manage events) admin access, so
   the team tools show up:
   ```sql
   update profiles set is_admin = true where id = (select id from auth.users where email = '<your-email>');
   ```
7. `npx expo start`

## Putting the website online (Vercel)

The app also runs as a website. The Vercel project is `havenly-app`
(public address: https://havenly-app-zeta.vercel.app).

**Automatic:** once the project is connected to this GitHub repo, every
change merged into `main` is built and published by Vercel using the
settings in `vercel.json` (`npm ci`, then `npm run build:web`, output in
`dist`). Pull requests get a private preview link.

**By hand (fallback):**

```bash
npm run build:web                       # builds dist/ and fixes the font/icon paths
cd dist
vercel link --yes --project havenly-app
printf '.env*\n.vercel\n' > .vercelignore
vercel deploy --prod --yes
```

Why `build:web` and not plain `expo export`: Vercel skips folders named
`node_modules`, which is where Expo puts the fonts and icons, so
`scripts/fix-web-assets.mjs` moves them to `assets/vendor`.
