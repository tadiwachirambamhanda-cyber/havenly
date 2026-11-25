# Lane brief: Lane A (v2)

Written by the Chief Architect on 2026-11-25 for Havenly v2. Replaces the v1 brief (in git history), whose work is merged.

| Field | Value |
|---|---|
| Lane name | `Lane A` |
| Goal | The housing side wears the approved v2 design: a simpler search, the rent split on the listing page, and "Students talking about this area" linking housing to Community. |
| Features | F16, the housing half of F14 (every housing screen restyled), the listing-page half of F20 |
| Worktree and branch | `.claude/worktrees/lane-a`, branch `worktree-lane-a` (a fresh one from main) |
| Starting point | main after the v2 foundation pull request is merged (the Chief Architect posts the commit) |
| Allowed files and folders | `src/screens/HousingScreen.tsx`, `ResidenceDetailScreen.tsx`, `SplitRentScreen.tsx` (to delete once the split is inline; remove its route by asking the Chief Architect), `HousingEnquiryScreen.tsx`, `HousingEnquirySentScreen.tsx`, `MyEnquiriesScreen.tsx`, `SavedScreen.tsx`, `SignInToContinueScreen.tsx`, `GuideScreen.tsx`, `StartGroupScreen.tsx`, `EnquiryGroupScreen.tsx`, `JoinGroupScreen.tsx`; `src/components/housing/` and its tests; new `src/lib/areaPosts.ts` and its test; `plans/lane-a-*` |
| Do not touch | Everything else, above all: `src/theme/`, `src/types/`, `src/navigation/`, `src/constants/`, `src/lib/` (except `areaPosts.ts`; read `rentSplit.ts`, `ranking.ts`, `housing.ts`, `requireAccount.ts`, `listing.ts` only), `src/guest/`, `supabase/`, `package.json`, `App.tsx`, `docs/`, `design/`, `CLAUDE.md`, Lane C's community and housemate screens, `ProfileScreen.tsx`, the team's admin screens. |
| Builds on | Design: `design/handoff/README.md`, `Housing.dc.html` and `ResidenceDetail.dc.html` (live canvas linked in the README); layouts that did not change are in `design/handoff/v1-housing/`. Tokens in `src/theme/tokens.ts` (new: `mintBg`, `mintText`, `photo`, `verifiedBg`, `verifiedText`). Data: `area_posts(p_residence, p_limit)` returns the posts tagged with that listing or its area for a signed-in student (none for signed-out visitors); `Post` in `src/types/index.ts`. Rent split: `splitRent`, `defaultPeople`, `formatAedRange` in `src/lib/rentSplit.ts`. |
| Dev server port | 8082 (`npx expo start --web --port 8082`) |
| Depends on / blocks | Depends on the foundation. Tapping an area post opens `PostDetail` with `{ postId }` (Lane C builds that screen; until then it shows "Coming soon"). "Ask about <area>" opens `CreatePost` with `{ area }` or `{ residenceId }`. Blocks nothing. |

## Done means

- [ ] **F14 (housing):** Housing, the listing page, Saved, the enquiry screens, group enquiry screens, sign-in sheet and renting guide match the handoff at 390 and 1440 wide in light and dark: berry primary buttons, mint "Bills included" and split panel, sun "Student deal", ink "Verified by Havenly", 22 px card radius, no sideways scroll.
- [ ] **F16 filters:** Housing shows search plus four pills: "Under AED 3,000" (price), "Kind of place", "Who it's for", "More filters". More filters opens bills included, student deal, bedrooms and Verified. The results and "Clear filters" work as today.
- [ ] **F16 split:** on a whole 3 bedroom home at AED 9,000 with bills AED 450 to 700, the listing page shows "Split between 3 people" with − and +, and "About AED 3,150 to 3,233 each a month" plus deposit each; changing to 2 updates every figure. The separate split sheet is gone, and nothing still opens it.
- [ ] **F20 (listing):** signed in, a listing shows "Students talking about this area" with up to 3 tagged posts (name, university, text, answer count) and "Ask about <area>"; tapping a post opens it. With none, only "Ask about <area>". Signed out, the section shows one line inviting them to sign in to read what students say.
- [ ] The mint banner between results ("Not sure about an area? … students talking about <area>") opens the Community tab. The Housing header's housemates button goes (housemates now live in Community); the listing page's whole-home housemate buttons stay.
- [ ] Every screen keeps its empty, loading and error states, and sending an enquiry, group enquiry, saving and alerts work as before.

## Checks to run before reporting

`npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`, `npx expo export --platform web`, the app at 390 and 1440 wide in light and dark, then /codex-review with every finding triaged, then /pr.

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

- You need to change a file on the "Do not touch" list (a route, a type, a token, a database function).
- The brief and the handoff disagree.
- The same error happens 3 times.
- You are about to build something not in "Done means".
