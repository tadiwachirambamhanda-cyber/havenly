# Lane brief: Lane A

Written by the Chief Architect. Merged to main before the lane starts.

| Field | Value |
|---|---|
| Lane name | `Lane A` |
| Goal | A student can find, understand, save, compare and enquire about a place, without an account until they save or enquire, and can split a whole home's rent with flatmates. |
| Features | F3, F5, F6 (the screens), F7, F8 (restyle only), F11 (display and the filter), F12, F13 (display and ranking) |
| Worktree and branch | `.claude/worktrees/lane-a`, branch `worktree-lane-a` |
| Starting point | main after the foundation pull request is merged (the Chief Architect posts the commit when it merges) |
| Allowed files and folders | `src/screens/HousingScreen.tsx`, `src/screens/ResidenceDetailScreen.tsx`, `src/screens/HousingEnquiryScreen.tsx`, `src/screens/HousingEnquirySentScreen.tsx`, `src/screens/MyEnquiriesScreen.tsx`, `src/screens/SplitRentScreen.tsx`, `src/screens/CompareScreen.tsx`, `src/screens/SignInToContinueScreen.tsx`, `src/components/housing/` (new), `plans/lane-a-*` |
| Do not touch | Everything else, above all: `src/theme/`, `src/types/`, `src/config/`, `src/navigation/`, `src/lib/` (including `rentSplit.ts`, `ranking.ts`, `requireAccount.ts`, `housing.ts`, `listing.ts`), `src/guest/`, `supabase/`, `package.json`, `App.tsx`, `docs/`, `design/`, `CLAUDE.md`, and the admin screens (Lane B). |
| Builds on | Design: `design/handoff/README.md`, the `.dc.html` prototypes and screenshots (Housing, ResidenceDetail, SplitRent, Compare, SignInToContinue, States). Code: tokens in `src/theme/tokens.ts` (`colors.fieldLine`, `dealBg`, `tintBg`, `errorBg`, and so on, plus the fonts), the fields on `Residence` in `src/types/index.ts`, `splitRent`, `moveInTotal` and `formatAedRange` in `src/lib/rentSplit.ts`, `sortForSearch`, `isStudentFriendly` and `effectiveMonthlyAed` in `src/lib/ranking.ts`, `useRequireAccount` in `src/lib/requireAccount.ts`, and `LISTING_TYPE_LABEL` in `src/lib/listing.ts` (read only). |
| Dev server port | 8082 (`npx expo start --web --port 8082`) |
| Depends on / blocks | Depends on the foundation. Does not wait for Lane B: use the demo sample listings in guest mode, or listings the team adds. The database migration `20261118200000_housing_foundation_fields.sql` must be applied to the live project before testing the new fields against it (the Chief Architect does that). Blocks nothing. |

## Done means

- [ ] **F3:** I open a verified listing and see the photo gallery and thumbnail strip, the price with the move-in costs and total, the commute to each nearby university, the Verified mark, and Open in Maps. An unverified listing has no Verified mark.
- [ ] **F5:** I choose "Private room", under AED 3,000 a month and "Female only" and only matching listings stay; "2 bedroom home" shows only 2 bedroom homes; sorting by price puts the cheapest first; clearing the filters brings everything back. "Verified by Havenly" is the first filter chip.
- [ ] **F11:** each card and the listing page say whether bills are included, or show the estimated monthly range; the "Bills included" filter keeps only those listings.
- [ ] **F12:** on a AED 9,000, 3 bedroom home with bills AED 450 to 700, the split sheet opens on 3 people and shows about AED 3,150 to 3,233 each, with the rent, bills, deposit and fees rows; changing to 2 people updates every figure; a listing with no price shows the "We cannot split this one yet" state.
- [ ] **F13:** a listing with a student deal shows the Student deal tag and the old price struck through, and "Student-friendly" listings sit above an identical listing with no deal in the default order.
- [ ] **F7:** I save 3 listings and Compare shows them in three columns with the right rows; choosing one then Enquire works; trying to add a 4th is refused with the limit message.
- [ ] **F6:** (ask the Chief Architect to set `PUBLIC_BROWSING` to true once your screens are safe for visitors) in a private window I see the Housing list, open a listing and the split sheet without signing in; tapping Save or Enquire opens "Make a free account to send your enquiry"; after creating an account I am back on the same listing.
- [ ] **F8:** sending an enquiry and following its status work as before, in the new look.
- [ ] Every screen has the empty, loading and error states from `design/handoff/States.dc.html`.
- [ ] Each screen matches the screenshots in `design/handoff/screenshots/` at 390 wide and at a laptop width, with no sideways scroll.

## Checks to run before reporting

The project checks (`npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`, `npx expo export --platform web`) all pass, then /codex-review with every finding triaged, then /pr.

## How to report

Send a message to "Chief Architect" in this format:

```text
STATUS: DONE | BLOCKED | QUESTION
PR: #<number>
Checks: green | red (what failed)
Files changed outside my allowed list: none
Look at: <one line on what to check first>
```

## When to stop and ask instead of guessing

- You need to change a file on the "Do not touch" list (for example a new field, a new helper, a navigation change or a new sample listing in demo mode).
- The brief and the handoff disagree.
- The same error happens 3 times.
- You are about to build something not in "Done means".
