# Plan: turn on browsing without an account, and give the demo the new sample listings

Branch: `feat/public-browsing-and-demo-samples`. Chief Architect. Follows the foundation and the two lane pull requests (all merged).

## Goal
A signed-out visitor lands on the real Housing screen, can open listings and the rent split, and is asked for an account only when they save, enquire or compare. The recruiter demo shows the new screens (a Verified listing, a student deal, a whole 3 bedroom home with the rent split).

## Feature
F6 (browse without an account), the switch behind it, and sample data for demo mode (Lane A's request).

## Steps
1. Turn `PUBLIC_BROWSING` on in `src/config/features.ts`.
2. Add to the demo's sample listings (`src/guest/fixtures.ts`): one Verified listing with costs, a whole 3 bedroom home (rent AED 9,000 a month, bills AED 450 to 700, deposit AED 4,500, fees AED 500), and the existing student-rate and bills-included listings. Tests prove the home's split is AED 3,150 to 3,233 and the other cases exist.
3. Test as a signed-out visitor against the real database, and in demo mode.

## Files
`src/config/features.ts`, `src/guest/fixtures.ts`, `src/guest/guest.test.ts`.

## Checks
typecheck, lint, tests (85), expo-doctor, web export; the browser checks below.

## What could break
A signed-out visitor now reaches the Housing screen instead of the login screen. The login screen (and the recruiter demo button) must stay reachable: it is, through "Log in".

## Not doing
Photos, real listings, the pitches, dark theme.

## Verification
1. Signed out, real database (a temporary active test listing, deleted afterwards): the landing page is Housing; with no listings it says "No places listed yet"; the test listing appeared with its split (AED 3,150 to 3,233 each for 3 people); opening it works without an account; tapping "Enquire or book a viewing" opened "Make a free account to send your enquiry"; creating an account there, skipping setup, returned the new account straight to the same listing.
2. "Log in" from Housing reaches the login screen, which still has "Explore without signing up".
3. Demo mode: Housing shows 4 places (Verified, student deals, bills estimates, housemates, the whole home); the rent split sheet shows AED 3,150 to 3,233 for 3 people and AED 4,725 to 4,850 for 2.
4. Test data and the test accounts were deleted: 0 listings, 0 test accounts, 1 admin.

## Codex review
Round 1: VERDICT FINDINGS(1).
1. MAJOR, `supabase/schema.sql` (room_types policy): signed-out visitors could read the rooms and prices of hidden listings, because the room policy allowed every row. **Fixed:** a migration (`20261118300000_room_types_follow_listing_visibility.sql`) makes a room visible only when its listing is; `schema.sql` matches. Applied to the live database on 2026-11-18 with the owner's yes (as SQL, recorded with `supabase migration repair`) and checked inside a rolled-back test: a signed-out visitor and a student see rooms only for visible listings, a hidden listing's rooms are invisible to them, an admin sees all, and partner terms stay hidden from non-admins.

Round 2: VERDICT PASS (no findings).

## Ideas for later
- On web, the save heart is a button inside the card button, which React logs as invalid HTML nesting in development (Lane A's `HousingScreen.tsx`, `housing/parts.tsx`). It works; fix by making the heart a sibling of the card.
- In the team form, a field's red edge stays after the mistake is fixed until the next save (Lane B's form).
- At about 290 px wide the longitude box in the team form runs off the edge (spec is 390 px and up).
- Not tried on a phone or at laptop width; no real photos yet.
