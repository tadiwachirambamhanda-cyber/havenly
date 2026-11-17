# Plan: Lane A, find a home (Housing, listing, split, compare, sign-in prompt)

Branch: `worktree-agent-acdc1620abfe4741a`. Source: `docs/lanes/lane-a.md`, `design/handoff/`.

## Goal
A student can find, understand, save, compare and enquire about a place. A visitor with no account can browse, open a listing and split a home's rent; an account is asked for only when they save, compare or enquire.

## Steps (each ends in something you can run or see)
1. **Pure helpers with tests** in `src/components/housing/` (`listingModel.ts`, `compareStore.ts`, `pendingReturn.ts`): monthly price of a listing, per-person range, bills line, move-in rows, filters, sort wiring to `sortForSearch`, compare set capped at 3, "go back to this listing after sign-up" memory. Run: `npm test`.
2. **Shared building blocks** (`src/components/housing/parts.tsx`): Verified badge, Student deal tag, Bills tag, error note (icon plus words), primary and outline buttons, state blocks. Run: typecheck.
3. **Housing screen** (F5, F11, F13, F6): wordmark and Log in for visitors, search box, filter chips (Verified first, price cap, Bills included, kind, bedrooms, student deal, who it is for), count and sort, result cards, empty, loading, error. Save heart goes through `useRequireAccount`. Run: demo mode in the browser.
4. **Listing page** (F3, F11, F13, F7): gallery and thumbnails, tags, Open in Maps, cost box with move-in total, Add to compare, commute list, the place, provider and permit, fixed action bar, unavailable and error states. Run: browser.
5. **Split sheet** (F12): panel, people stepper (starts at bedrooms), rows, "We cannot split this one yet". Run: browser plus unit tests.
6. **Compare** (F7): three columns, Choose, Remove, limit message, Enquire about the chosen place, empty and error. Run: browser.
7. **Sign-in sheet** (F6): email, password with Show, rule line, Create account, Log in instead, Not now; after success the visitor lands back on the listing.
8. **Enquiry screens and My enquiries restyle** (F8): new look, same behaviour; empty, loading and error states.
9. Final checks, browser check at 390 wide, Codex review, pull request.

## Files
Change only: `src/screens/HousingScreen.tsx`, `ResidenceDetailScreen.tsx`, `HousingEnquiryScreen.tsx`, `HousingEnquirySentScreen.tsx`, `MyEnquiriesScreen.tsx`, `SplitRentScreen.tsx`, `CompareScreen.tsx`, `SignInToContinueScreen.tsx`. New: `src/components/housing/*`, this plan.

## Checks
typecheck, lint, tests, expo-doctor, web export; browser walk-through in demo mode; Codex review.

## What could break
- Signed-out navigator does not include `Compare`, `HousingEnquiry`, `MyEnquiries`: every tap goes through `useRequireAccount` first.
- Prices live on room types (per month, semester or year); a whole home's rent is its cheapest available room as a monthly figure.
- Demo sample content has no whole home, no Verified listing and no commute to compare, so those parts are proven by unit tests (request to Chief Architect).

## Not doing
Map view, dark theme redesign, price gauge, Arabic, admin screens, flipping `PUBLIC_BROWSING`.

## Ideas for later
Persist the compare list; send the split to flatmates; uneven splits.

## Codex review
Round 1: FINDINGS(2).
1. MINOR, compare list stays in memory across accounts on a shared device. **Fixed:** it starts empty when a different account (or nobody) is signed in; test added.
2. MINOR, enquiry budget had every non-digit stripped, so "-5000" became 5000. **Fixed:** only whole AED (digits or comma groups) is accepted, anything else shows the error.

Round 2: FINDINGS(4).
1. MAJOR, a listing with no room records stays enquirable and the enquiry form does not block on a failed load. **Dismissed:** that is the existing behaviour and what the design asks for ("Send an enquiry and the Havenly team will confirm the price"); the database policy and the signed-in check protect the write, and a failed load shows an error note but the enquiry still goes to a real listing id the server validates.
2. MINOR, the "Not yet checked by Havenly" tag on unverified listings. **Dismissed:** the design (States, student deal and not-yet-verified variant) shows exactly this wording, and there is no Verified mark on those listings.
3. MINOR, budget could exceed the database column. **Fixed:** above AED 10,000,000 is refused.
4. MINOR, My enquiries keeps old rows if the session vanishes. **Dismissed:** the screen only exists in the signed-in navigator, which unmounts it on sign-out.

Stopped here: only dismissed findings remain.

## Verification
typecheck, lint, 65 tests, expo-doctor (21 of 21) and the web export pass. In demo mode at about 390 wide: Housing (search, filters, cards), a listing (cost box, rooms, commute, Add to compare), Compare (chosen column, Enquire) and the enquiry form render in the new look. Not seen in the browser (needs a whole home or `PUBLIC_BROWSING`): the split sheet, the Verified badge, the student deal tag, the sign-in sheet. These are covered by unit tests of the numbers and filters (including AED 3,150 to 3,233 for the 9,000 home, the 3 place limit, deal ranking).
