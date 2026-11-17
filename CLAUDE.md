# Havenly

Project type: app (React Native, Expo, Supabase). Web build on Vercel.

## Rules
- Follow the global rules in `~/.claude/CLAUDE.md`. Work on a branch, small commits, a pull request for every change. Never merge without the owner saying "merge".
- Secrets stay out of the repo. `app.json` holds only the Supabase anon key and a Mapbox public token, which are meant to ship in the app; data access is protected by row-level security.
- Guest mode (`src/guest/`) must never reach the real database. It runs on bundled sample content only and blocks every write. Read `docs/guest-mode-brief.md` before touching it.
- Checks: `npm run typecheck`, `npm run lint`, `npm test`.
