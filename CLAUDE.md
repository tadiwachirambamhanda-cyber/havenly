# Havenly

Project type: app (React Native, Expo, Supabase). Web build on Vercel.

Havenly is a student accommodation platform for Dubai. See `docs/prd.md` for what it is and `docs/feature-list.md` for what to build, in order. `PROJECT_BRIEF.md` describes the earlier social-app version and is partly out of date.

## Rules
- Follow the global rules in `~/.claude/CLAUDE.md`. Work on a branch, small commits, a pull request for every change. Never merge without the owner saying "merge".
- Secrets stay out of the repo. `app.json` holds only the Supabase anon key and a Mapbox public token, which are meant to ship in the app; data access is protected by row-level security.
- Guest mode (`src/guest/`) must never reach the real database. It runs on bundled sample content only and blocks every write. Read `docs/guest-mode-brief.md` before touching it.
- Checks: `npm run typecheck`, `npm run lint`, `npm test`.

## Who owns which files (lanes)

Work is split into two lanes plus the Chief Architect. A lane changes only the paths it owns. Anything else is asked for from the Chief Architect, who changes it on its own branch and pull request. Lane briefs are in `docs/lanes/`.

| Path | Owner |
|---|---|
| `src/theme/`, `App.tsx`, `app.json`, `package.json`, `package-lock.json` | Chief Architect |
| `src/types/`, `src/config/`, `src/navigation/`, `src/lib/AuthContext.tsx`, `src/lib/ThemeContext.tsx`, `src/lib/supabase.ts`, `src/lib/housing.ts`, `src/lib/rentSplit.ts`, `src/lib/ranking.ts`, `src/lib/requireAccount.ts` | Chief Architect |
| `supabase/` (schema and migrations), `src/guest/` (demo mode and its sample data) | Chief Architect |
| `docs/`, `design/`, `CLAUDE.md`, `.github/`, `plans/` for the Chief Architect's own plans | Chief Architect |
| `src/screens/HousingScreen.tsx`, `ResidenceDetailScreen.tsx`, `HousingEnquiryScreen.tsx`, `HousingEnquirySentScreen.tsx`, `MyEnquiriesScreen.tsx`, `SplitRentScreen.tsx`, `CompareScreen.tsx`, `SignInToContinueScreen.tsx`, `src/components/housing/`, `plans/lane-a-*` | Lane A (find a home) |
| `src/screens/EditResidenceScreen.tsx`, `ManageHousingScreen.tsx`, `AdminEnquiryScreen.tsx`, `src/lib/listing.ts` and its test, `src/components/admin/`, `plans/lane-b-*` | Lane B (listings and deals, team side) |
| Every other screen, component and library file (the social part, shared components) | Chief Architect: not part of the housing lanes, change only when the owner asks |

Dev server ports (Expo web, `npx expo start --web --port <port>`): main 8081, Lane A 8082, Lane B 8083.
