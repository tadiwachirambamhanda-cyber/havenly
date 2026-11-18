# Plan: remove the interests features, bring the Map back, update the privacy policy

Branch: `chore/remove-interests`. Owner's decisions: remove the interests picker from Edit profile; for place "interested" taps do the recommended cleanup; update the privacy policy. Mid-build the owner found the Map could no longer be opened, so a Map button is added too.

## Goal
No interests anywhere a student can see them, the Map reachable again, and a privacy policy that describes what the app does now.

## Steps
1. Edit profile: remove the Interests picker and its save. Existing `profiles.interests` values are left alone in the database (no migration). Delete `src/constants/topicIcons.ts` (nothing uses it now).
2. Map code: stop loading offers, events, check-ins and "interested" taps; remove the live channel `map-live` (check-ins and interests), the check-in, ping and interest handlers, and the offer, event and person search. The Map's embedded page keeps its old pin code, now fed empty lists (inert); deleting it needs a phone test, so it is left for later.
3. Map entry point: a map-pin button on the Housing header (everyone, signed in or not), and the Map registered in the signed-out screens too.
4. Privacy policy: remove interests, posts, comments, communities, follows, check-ins, group messages and perks; keep what is true (account, profile, saved places, enquiries, messages, location for the map, technical logs, providers); personalising the feed becomes "how far each place is from your university"; update the date to 18 November 2026. Everything else stays as drafted (still marked as a draft for a UAE lawyer).
5. Checks, browser walk-through, Codex review.

## Files
`src/screens/EditProfileScreen.tsx`, `MapScreen.tsx`, `HousingScreen.tsx`, `src/navigation/RootNavigator.tsx`, `src/navigation/routes.test.ts`, `src/constants/legal.ts`, delete `src/constants/topicIcons.ts`.

## Checks
typecheck, lint (no warnings), tests; browser: Housing shows the Map button (signed out and in), Map opens its web notice, Edit profile has no Interests section.

## What could break
The Map on a phone: the React side lost a lot of code around it. Not testable on the web (native only). Owner check: open Housing, tap the map-pin, see homes (once there are listings with coordinates).

## Not doing
Deleting the offers (perks) code or its "interested" button, the database column and tables, or the Terms of use. **The Terms still mention posts, perks, events and check-ins and need the same update**, for the owner to approve.

## Questions
None.

## Codex review
Round 1: VERDICT FINDINGS(2).
1. MAJOR, `legal.ts:33`: the policy said one-to-one messages only, but group chats that already exist are still stored and open. **Fixed:** it now says messages, including one-to-one chats and any group conversations you are already part of.
2. MINOR, `MapScreen.tsx:637`: the search box still said "events, offers, housing, friends". **Fixed:** "Search a home or an area".

Round 2: VERDICT FINDINGS(2).
3. MAJOR, `legal.ts:34`: the policy said location is used only for the map, but the perks screen (still in the code, unlinked) sorts by distance. **Fixed:** the original wording is back: "the map or location-based sorting".
4. MINOR, `legal.ts:57`: Sentry crash reporting is off until a key is set, but the policy described it as running. **Fixed:** the policy now says crash reports apply "when crash reporting is switched on".
