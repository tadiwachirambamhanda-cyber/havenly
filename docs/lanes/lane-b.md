# Lane brief: Lane B

Written by the Chief Architect. Merged to main before the lane starts.

| Field | Value |
|---|---|
| Lane name | `Lane B` |
| Goal | The Havenly team can add and edit a listing of any kind with everything students need to see (kind, bedrooms, costs, bills, student deal, Verified mark, photos, commute), and the admin screens look like the rest of the redesigned app. |
| Features | F2, F11 (the admin fields), F13 (the admin fields), the admin screens restyled |
| Worktree and branch | `.claude/worktrees/lane-b`, branch `worktree-lane-b` |
| Starting point | main after the foundation pull request is merged (the Chief Architect posts the commit when it merges) |
| Allowed files and folders | `src/screens/EditResidenceScreen.tsx`, `src/screens/ManageHousingScreen.tsx`, `src/screens/AdminEnquiryScreen.tsx`, `src/lib/listing.ts`, `src/lib/listing.test.ts`, `src/components/admin/` (new), `plans/lane-b-*` |
| Do not touch | Everything else, above all: `src/theme/`, `src/types/`, `src/config/`, `src/navigation/`, other files in `src/lib/` (`rentSplit.ts`, `ranking.ts`, `requireAccount.ts`, `housing.ts`), `src/guest/`, `supabase/`, `package.json`, `App.tsx`, `docs/`, `design/`, `CLAUDE.md`, and the student-facing housing screens (Lane A). |
| Builds on | Design: `design/handoff/README.md`, `EditResidence.dc.html`, its screenshot and the Edit listing rows in `States.dc.html`. Code: tokens in `src/theme/tokens.ts`; the new fields on `Residence` in `src/types/index.ts` (`bills_included`, `bills_min_aed`, `bills_max_aed`, `student_deal_types`, `student_rate_aed`, `housemates`, `commutes`); the `save_residence` function in `supabase/migrations/20261118200000_housing_foundation_fields.sql`, which already accepts them (a field you leave out keeps its stored value); `checkListingFields` in `src/lib/listing.ts`. |
| Dev server port | 8083 (`npx expo start --web --port 8083`) |
| Depends on / blocks | Depends on the foundation, and on the migration being applied to the live project before saving the new fields for real (the Chief Architect does that). Does not wait for Lane A. Blocks nothing. |

## Done means

- [ ] **F2:** as an admin I add a listing of each of the five kinds (a student residence, a room in a shared apartment, a private room, a studio and a whole home) with photos, price, area, nearby universities and amenities, and each appears in the Housing list and opens with its photos.
- [ ] **F11 (admin):** I switch "Bills are included in the rent" on or off; when off I enter an estimate from and to; I save, reopen, and the values are there. An estimate where the top is below the bottom, or only one of the two numbers, is refused with a clear message.
- [ ] **F13 (admin):** I switch "Offer a student deal" on, tick the type or types (student rate, deposit waived, fees waived, free first month, group discount), enter a student rate when there is one, save, reopen, and it is there. A student rate of 0 or a negative number is refused.
- [ ] Housemates and commute times can be set for a listing (a commute is a university, minutes and a mode: bus, metro, walk, taxi or shuttle) and are saved and reloaded.
- [ ] `src/lib/listing.ts` validates the new fields (and the existing F1 ones) with unit tests: the pairs, the ranges, the allowed types, and the messages.
- [ ] The form matches `design/handoff/EditResidence.dc.html` and its states (validation, save failed, saving); the error appears next to the Save button or is scrolled into view, not only at the bottom of a long form.
- [ ] Manage housing and the enquiry screens are restyled to the new look with no change in behaviour (an enquiry still moves from new to signed with the referral fee calculated).
- [ ] Saving an existing listing without touching the new fields leaves them unchanged.

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

- You need to change a file on the "Do not touch" list (for example a new database field or a type).
- The brief and the handoff disagree.
- The same error happens 3 times.
- You are about to build something not in "Done means".
