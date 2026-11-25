# Havenly

Project type: app (React Native, Expo, Supabase). Web build on Vercel.

Havenly is a student accommodation platform for Dubai. See `docs/prd.md` for what it is and `docs/feature-list.md` for what to build, in order. `PROJECT_BRIEF.md` describes the earlier social-app version and is partly out of date.

## Rules
- The old social features are archived at git tag `archive/social-v1` (`docs/archive/social.md`). On 2026-11-25 the owner asked for a community in v2 (`docs/prd.md`): university communities, posts, area questions, housemates, events, perks and reports. Follows, a global feed, video and check-ins stay archived.
- Follow the global rules in `~/.claude/CLAUDE.md`. Work on a branch, small commits, a pull request for every change. Never merge without the owner saying "merge".
- Secrets stay out of the repo. `app.json` holds only the Supabase anon key and a Mapbox public token, which are meant to ship in the app; data access is protected by row-level security.
- Guest mode (`src/guest/`) must never reach the real database. It runs on bundled sample content only and blocks every write. Read `docs/guest-mode-brief.md` before touching it.
- Checks: `npm run typecheck`, `npm run lint`, `npm test`.

## Who owns which files (lanes)

v2 (2026-11-25): the Chief Architect builds the shared foundation first; then Lane A (housing) and Lane C (community) work in parallel. Lane B (the team's listing tools) is paused. A lane changes only the paths it owns. Anything else is asked for from the Chief Architect, who changes it on its own branch and pull request. Lane briefs are in `docs/lanes/`.

| Path | Owner |
|---|---|
| `src/theme/`, `App.tsx`, `app.json`, `package.json`, `package-lock.json` | Chief Architect |
| `src/types/`, `src/navigation/`, `src/constants/`, `src/lib/AuthContext.tsx`, `src/lib/ThemeContext.tsx`, `src/lib/supabase.ts`, `src/lib/housing.ts`, `src/lib/rentSplit.ts`, `src/lib/ranking.ts`, `src/lib/requireAccount.ts`, `src/screens/ComingSoonScreen.tsx`, `src/screens/SettingsScreen.tsx` | Chief Architect |
| `supabase/` (schema and migrations), `scripts/db-tests/`, `src/guest/` (demo mode and its sample data) | Chief Architect |
| `docs/`, `design/`, `CLAUDE.md`, `.github/`, `plans/` for the Chief Architect's own plans | Chief Architect |
| `src/screens/HousingScreen.tsx`, `ResidenceDetailScreen.tsx`, `SplitRentScreen.tsx`, `HousingEnquiryScreen.tsx`, `HousingEnquirySentScreen.tsx`, `MyEnquiriesScreen.tsx`, `SavedScreen.tsx`, `SignInToContinueScreen.tsx`, `GuideScreen.tsx`, `StartGroupScreen.tsx`, `EnquiryGroupScreen.tsx`, `JoinGroupScreen.tsx`, `src/components/housing/`, `src/lib/areaPosts.ts`, `plans/lane-a-*` | Lane A (housing) |
| `src/screens/CommunityScreen.tsx`, `CommunityDetailScreen.tsx`, `CreatePostScreen.tsx`, `PostDetailScreen.tsx`, `EventDetailScreen.tsx`, `PerksScreen.tsx`, `PerkDetailScreen.tsx`, `ReviewQueueScreen.tsx`, `ManageEventsScreen.tsx`, `ManagePerksScreen.tsx`, `HousemateBoardScreen.tsx`, `MyHousemateCardScreen.tsx`, `HousemateReviewScreen.tsx`, `ProfileScreen.tsx` (its Housemates block), `src/components/community/`, `src/lib/community*.ts`, `src/lib/housemates*.ts`, `plans/lane-c-*` | Lane C (community) |
| `src/screens/EditResidenceScreen.tsx`, `ManageHousingScreen.tsx`, `AdminEnquiryScreen.tsx`, `src/lib/listing.ts` and its test, `src/components/admin/`, `plans/lane-b-*` | Lane B (paused) |
| Every other screen, component and library file | Chief Architect: change only when the owner asks |

Dev server ports (Expo web, `npx expo start --web --port <port>`): main 8081, Lane A 8082, Lane B 8083, Lane C 8084.
