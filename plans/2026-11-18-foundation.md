# Plan: foundation for the housing-first lanes

Branch: `docs/design-brief` (it already carries the PRD, feature list, design brief, screen map, inspiration board and design handoff, so everything reaches main in one pull request). Written by the Chief Architect. Source: `docs/prd.md`, `docs/feature-list.md`, `design/brief.md`, `design/handoff/README.md`.

## Goal
Put the shared groundwork on main so two lanes can build the housing screens without touching the same files: the new look (oxblood and stone, new fonts), housing as the first tab, the shared data fields and tested calculations for bills, rent split and student deals, empty screens and routes for the new screens, and the two lane briefs.

## Feature
Not a feature ID. It is the contract for F4 and F6 (navigation and sign-in rules, behind a switch), F11 to F13 (data and calculations), and the design tokens. The lanes build F2, F3, F5, F6 (screens), F7, F8, F10, F11 to F13 on top of it.

## Steps
1. **Tokens and fonts.** Change the colour values in `src/theme/tokens.ts` to oxblood and stone for the light theme, add the new semantic tokens (field line, deal, notice, error), and switch the font families to Schibsted Grotesk and Hanken Grotesk. Dark theme keeps its current accent for now (it was not designed). Replace the old font names in all screens. Run: the web build exports and the Housing list, a listing and the feed look right on screen.
2. **Data.** One migration adds bills (included or not, estimated monthly range), student deals (types and a student rate), housemates and commute minutes to `residences`, with check rules, and extends `save_residence` to store them (an older request that omits them keeps the stored values). `schema.sql`, `src/types/index.ts` and the demo fixtures get the same fields. Run: tests pass; the migration is applied to the live database only after the owner says yes.
3. **Shared calculations with tests.** Pure, tested helpers: per-person rent split (rent, bills as a range or included, deposit and fees), the move-in total, "student-friendly" and the search ordering (student-friendly first, then Verified, then price). Run: unit tests, including the design's example (AED 9,000, 3 people, bills AED 450 to 700 gives AED 3,150 to 3,233 each).
4. **Navigation.** Housing becomes the first tab and the opening tab. Empty screens for `SplitRent`, `Compare` and `SignInToContinue` are registered. A switch `PUBLIC_BROWSING` (off) wires a signed-out Housing, listing, split and sign-in prompt, and a `requireAccount` helper opens the sign-in prompt when a signed-out visitor tries to save or enquire. Run: with the switch off the app behaves as today; typecheck passes.
5. **Lane groundwork.** A folder-owner table and the ports line in `CLAUDE.md`, `.worktreeinclude`, and `docs/lanes/lane-a.md` and `lane-b.md`.
6. **Checks.** typecheck, lint, tests, expo-doctor, web export; Codex review; then `/pr`.

## Files
- Change: `src/theme/tokens.ts`, `App.tsx`, `package.json` and its lock file (two font packages), about 46 screens and components (font names only), `supabase/schema.sql`, `src/types/index.ts`, `src/guest/fixtures.ts`, `src/navigation/RootNavigator.tsx`, `src/navigation/TabBar.tsx` (only if the tab order needs it), `CLAUDE.md`.
- Create: `supabase/migrations/20261118200000_housing_foundation_fields.sql`, `src/lib/rentSplit.ts`, `src/lib/ranking.ts` with tests, `src/lib/requireAccount.ts`, `src/config/features.ts`, `src/screens/SplitRentScreen.tsx`, `CompareScreen.tsx`, `SignInToContinueScreen.tsx` (empty), `.worktreeinclude`, `docs/lanes/lane-a.md`, `docs/lanes/lane-b.md`.

## Checks
1. `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor` and `npx expo export --platform all` pass.
2. The rent-split test reproduces the design's numbers; ranking tests prove student-friendly and Verified listings come first.
3. In the web app (switch off): sign-in, the Housing tab (now first), a listing, Settings and the feed all still work with the new colours and fonts, and nothing is cut off.
4. The migration is additive: every column has a default or allows null, and an old-style save still works (tested inside a rolled-back block once applied).

## What could break
The font and colour swap touches almost every screen: text could be wider or taller with the new fonts and clip. I check the main screens on screen. The navigation change risks the signed-out flow, which is why public browsing stays switched off until Lane A makes the Housing screen safe for visitors.

## Not doing
- Any real housing screen work (that is the lanes): search and filters, the listing page content, Compare, the split sheet, the admin form fields.
- Dark theme redesign, Arabic, map view.
- Turning `PUBLIC_BROWSING` on.

## Questions
1. May I apply the new database migration to the live project when it is ready (step 2)? It only adds columns and replaces `save_residence`, as in F1.

## Codex review
Round 1: VERDICT FINDINGS(7).
1. MAJOR, `src/lib/requireAccount.ts` and `RootNavigator.tsx`: with `PUBLIC_BROWSING` on, Save and Enquire would navigate to screens missing from the signed-out navigator or write without a session. **Dismissed for the foundation, made explicit for Lane A:** the switch is off, so nothing changes for a signed-out visitor today; the lane brief gives Lane A the work of routing Save, Enquire and Compare through `useRequireAccount` and now lists it as a done check, and the switch is only flipped by the Chief Architect after that. Visitors only read listings through the existing policy that shows active listings.
2. MAJOR, `save_residence`: an older request that omits old fields (name, amenities, photos) would blank them. **Dismissed:** that is how the function has always worked (a full-form save) and every client sends all of those fields; only the new fields were made tolerant of omission, so an older app does not wipe them. Making every field optional is outside this plan.
3. MAJOR, `student_deal_types` CHECK passes NULL elements. **Dismissed, with evidence:** run against the live database, `array[null]::text[] <@ array['student_rate', ...]` returns false, so a NULL element is rejected, as is a bogus value; a valid array and an empty array pass.
4. MAJOR, `rentSplit.ts`: huge or unsafe integers lose precision; `moveInTotal` did no validation. **Fixed:** amounts must be safe whole AED up to 10,000,000, and `moveInTotal` returns null for a bad amount; tests added.
5. MINOR, `ranking.ts`: NaN, infinite, zero and negative prices. **Fixed:** they count as unknown and sort last; a zero or negative student rate is not a deal; tests added.
6. MINOR, `Text.tsx`: the helper still matched the old font prefix, so nested text with its own weight would have stopped switching weight. **Fixed:** it matches `HankenGrotesk_`, comments updated.
7. MINOR, hard-coded old colours on listing controls. **Fixed** for the saved-heart colour in `HousingScreen.tsx` and `ResidenceDetailScreen.tsx`. Left as is, on purpose: the video progress bar in `PostVideoPlayer.tsx` (over dark video, social part) and the native-only map pin popup in `MapScreen.tsx`.

Round 2: VERDICT PASS (no findings).

## Verification
1. `npm run typecheck`, `npm run lint`, `npm test` (50 tests, 25 of them new for the rent split, move-in total and ranking, including the design's example of AED 3,150 to 3,233 each), `npx expo-doctor` (21 of 21) and `npx expo export --platform all` all pass.
2. In the web app (demo mode, light theme): the Housing tab is now first and opens first, the feed, Housing list and sign-in screen show the new colours and fonts with nothing cut off, and the demo banner is readable. With `PUBLIC_BROWSING` off a signed-out visitor still sees the login screen.
3. The migration `20261118200000_housing_foundation_fields.sql` is written and reviewed but **not yet applied to the live database**; it waits for the owner's yes. A NULL-element check was run against the live database by a read-only query.
4. The dark theme keeps its previous accent; it was not part of the redesign.

## Changes from the plan
- Added a small fix to `GuestBanner.tsx` (its "Create account" link was oxblood on a dark strip) and updated `app.json`'s splash background to the new ground colour. The icon artwork and splash image were not regenerated.
