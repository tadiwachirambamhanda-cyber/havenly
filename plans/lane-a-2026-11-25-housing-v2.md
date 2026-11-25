# Lane A: housing in the v2 look (F16, F14 housing half, F20 listing half)

Brief: `docs/lanes/lane-a.md`. Design: `design/handoff/README.md`, `Housing.dc.html`, `ResidenceDetail.dc.html`.

## Goal

A student sees the housing side in the approved v2 look: a simpler search with four pills, the rent split worked out on the listing page itself, and "Students talking about this area" on each listing so housing and Community feel like one app.

## Feature

- **F16**: "On Housing I see four controls and a More filters button that opens bills, deal, bedrooms and Verified. On a 3 bedroom home I change people from 3 to 2 on the page and each share updates."
- **F14 (housing half)**: every housing screen in the new colours and type, light and dark, at 390 and 1440 wide.
- **F20 (listing half)**: "I open a JLT listing and my post is under Students talking about this area; tapping it opens the post."

## Steps

1. **Shared parts** (`src/components/housing/parts.tsx`): pills for tags (Verified in `verifiedBg`/`verifiedText`, Bills included in mint, Student deal in sun), pill-shaped primary (54 px) and outline buttons, 22 px card radius and 16 px field radius as shared constants, no hard-coded light colours. Run: typecheck, tests.
2. **Area posts data** (`src/lib/areaPosts.ts` + test): call `area_posts(p_residence, 3)`, then read each author's name and university from `profiles`; pure helpers for the "2h / 1d" time and "4 answers" label; skipped for signed-out visitors and demo guests. Run: `npm test` (new tests pass).
3. **Filter model** (`listingModel.ts` + test): labels for the price, kind and who pills, a count of "More filters" that are on, and the price options (Any, 2,500, 3,000, 4,000). Run: `npm test`.
4. **Housing screen**: header without the housemates button; title "Find your place near campus"; search; four pills (price, Kind of place, Who it's for, More filters) each opening a small panel under the row; More filters holds Bills included, Student deal, bedrooms 1/2/3 and Verified; count and sort; v2 cards (178 px photo, badge top left, heart top right, 24 px price, mint Bills included, name, kind · area, commute with icon); the mint "Not sure about an area?" banner after the first result opens the Community tab. Empty, loading, error states and Clear filters stay. Run: app at 390 in light and dark.
5. **Listing page**: 320 px photo gallery with back, save and "1 / N"; sheet overlapping by 24 px; Verified and kind pills; cost card with the mint split panel (Split between N people, − and +, 1 to 10, default = bedrooms, "About AED X to Y each a month", deposit each); To move in rows; Getting to campus rows with icons and Open in Maps; "Students talking about this area" (up to 3 posts, "Ask about <area>"; signed out: one line to sign in); fixed bottom with "Enquire or book a viewing" and, for whole homes, "Enquire with friends". The "Split the rent" button that opened the sheet goes. Housemate buttons stay. Run: app, a whole 3 bedroom home.
6. **Other housing screens** restyled to the tokens and shapes: Saved, enquiry form and sent, My enquiries, sign-in sheet, guide, start / join / group enquiry. Run: each at 390 light and dark.
7. **Checks and review**: typecheck, lint, tests, expo-doctor, web export, then /codex-review and /pr.

## Files

`src/components/housing/parts.tsx`, `src/components/housing/listingModel.ts`, `src/components/housing/housing.test.ts`, new `src/lib/areaPosts.ts` and `src/lib/areaPosts.test.ts`, `src/screens/HousingScreen.tsx`, `ResidenceDetailScreen.tsx`, `SavedScreen.tsx`, `HousingEnquiryScreen.tsx`, `HousingEnquirySentScreen.tsx`, `MyEnquiriesScreen.tsx`, `SignInToContinueScreen.tsx`, `GuideScreen.tsx`, `StartGroupScreen.tsx`, `EnquiryGroupScreen.tsx`, `JoinGroupScreen.tsx`. `SplitRentScreen.tsx` stays in place until its route is removed (see Questions).

## Checks

- `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`, `npx expo export --platform web` all pass.
- Housing at 390 wide: four pills and nothing else in the row; tap "More filters": Bills included, Student deal, 1/2/3 bedrooms and Verified show; pick a filter with no matches: "Clear filters" brings every place back.
- A whole 3 bedroom home at AED 9,000 with bills AED 450 to 700 shows "Split between 3 people" and "About AED 3,150 to 3,233 each a month"; tap − and it reads 2 people and "About AED 4,725 to 4,850 each a month", deposit each halves too. (Unit test covers the numbers with `splitRent`.)
- Signed out, a listing shows one line inviting sign-in under "Students talking about this area". Signed in with no tagged posts: only "Ask about <area>".
- The mint banner opens the Community tab. No housemates button in the Housing header. Nothing navigates to `SplitRent` (`grep -rn "'SplitRent'" src/screens src/components` is empty).
- Light and dark, 390 and 1440 wide: no sideways scroll, text readable.

## What could break

The Housing screen rewrite could break filtering, saving or the "back to the listing after sign-up" return. The filter logic stays in `listingModel.ts` (unit tested), and saving code is unchanged.

## Not doing

The bell with an unread dot from the design (not in the brief's Done means), a post count in the mint banner (no data for it), removing the `SplitRent` route or file (navigation is not mine), Map and Compare (F17, the foundation), the Community screens and PostDetail (Lane C).

## Questions (for the Chief Architect, not blocking)

1. Remove the `SplitRent` route from `src/navigation/RootNavigator.tsx` (both stacks) and its test, then I delete `SplitRentScreen.tsx`.
2. The handoff's Housing header shows a bell with an unread dot; the brief does not list it. Add it (to Notifications) or leave it?
3. The mint banner in the handoff says "12 students talking about Al Barsha this week"; there is no count of that, so it reads "See what students say about <area>" without a number.

## Plan check

Fresh-reviewer, dimension plan, FINDINGS(5).

1. Fixed: the area posts section has four states, each covered by a test of a pure state function in `areaPosts.ts`: signed out (one sign-in line), demo guest (no call, only "Ask about <area>", no sign-in line), call failed (a quiet "We could not load what students say" line with Try again; the rest of the page stays), and posts. A missing author shows "A student".
2. Kept as Question 1: the route and file are the Chief Architect's. Until then the button is gone and nothing opens the sheet; the report says so rather than ticking that box silently.
3. Fixed in part: a post card is a button that opens `PostDetail` with `{ postId }` (the "Coming soon" placeholder until Lane C ships). Dismissed "pass both": "Ask about <area>" sends `{ area }` because the button asks about the area, and F20 wants area questions to show on every listing in that area.
4. Fixed: the price pill reads "Under AED 3,000" when no price is set and "Under AED <cap>" when one is; More filters reads "More filters" or "More filters · N", N counting bills, deal, bedrooms (one) and Verified. Test: all four set = 4.
5. Fixed: unit tests for the panel text with unknown bills, bills included, no deposit and an uneven deposit.
