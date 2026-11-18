# Plan: Lane B, the team's listing form and admin screens

Branch: `worktree-agent-abf14e44f62eef04a` (Lane B). Brief: `docs/lanes/lane-b.md`, `docs/prd.md`, `docs/feature-list.md`.

## Goal
The Havenly team can add and edit a listing of any kind with everything students need to see: bills (included, or an estimate), a student deal, housemates and commute times, on top of the kind, bedrooms, costs, Verified mark and permit that already exist. The form, Manage housing and the enquiry screen all use the new look (oxblood and stone, Schibsted and Hanken Grotesk).

## Steps (each ends in something to run or see)
1. **Checks for the new fields, with tests.** `src/lib/listing.ts` gets pure functions `checkBills`, `checkStudentDeal`, `checkHousemates` and `checkCommutes`, plus the lists of deal types and commute modes. Existing `checkListingFields` keeps its behaviour (it only gains a `field` name on its errors so the form can mark the right box). Run result: `npm test` shows the new cases passing: bills pair and range, deal types, student rate above zero, housemates 0 to 10, commute needs a university, minutes above zero and one of bus, metro, walk, taxi, shuttle.
2. **Form pieces in the new look.** New `src/components/admin/` with the small building blocks the form needs: section label, text field (48 high), chip (40 high), switch row, error note (icon plus words), and a Save button that shows "Saving...". Run result: typecheck and lint pass; the pieces are used in step 3.
3. **The form.** `EditResidenceScreen.tsx` is rebuilt to match `EditResidence.dc.html`: Bills (switch, from and to), Student deal (switch, type chips, student rate), housemates and "Getting to campus" (commute rows) added in the same style, Save in the header and at the bottom. It loads the new fields, and sends them to `save_residence` with the exact keys of the migration. Validation errors show a banner with an icon under the header and above the bottom Save, the page scrolls up to it, and the field with the problem gets a red edge. Save failed and Saving states match `States.dc.html`. A group of new fields that was not touched on an existing listing is not sent at all, so the stored values cannot change (the migration keeps what it already has).
4. **Manage housing and enquiry screens.** Restyled (colours, fonts, 44 px targets, radii) with no change in what they do. "Residences" becomes "Listings". An enquiry still moves from new to signed with the referral fee calculated.
5. **Full checks, browser look, Codex review, pull request.**

## Files
- Change: `src/lib/listing.ts`, `src/lib/listing.test.ts`, `src/screens/EditResidenceScreen.tsx`, `src/screens/ManageHousingScreen.tsx`, `src/screens/AdminEnquiryScreen.tsx`.
- Create: `src/components/admin/*`, this plan.

## Checks
1. `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`, `npx expo export --platform web` all pass.
2. Unit tests: bills estimate with only one number refused; top below bottom refused; bills included clears the estimate; deal switch on with no type refused; student rate 0 or negative refused; housemates 11 or -1 refused; a commute without a university, with 0 minutes, or with mode "plane" refused; the existing F1 tests still pass.
3. Save payload keys (`bills_included`, `bills_min_aed`, `bills_max_aed`, `student_deal_types`, `student_rate_aed`, `housemates`, `commutes`) match the migration exactly; read by eye against the SQL.
4. Looked at in the browser at 390 wide as far as demo mode allows (no sideways scroll, nothing cut off).

## What could break
- Saving an existing listing could overwrite stored bills, deal, housemates or commute values with blanks. Guard: those groups are sent only when the team changed them; "bills not stated" stays "not stated" until the switch is touched.
- A stored commute that the new rules would refuse (for example 0 minutes) could block an unrelated save. Same guard: an untouched commute list is not checked or sent.
- The real save can only be proven against the live database (the Chief Architect does that).

## Not doing
- Any change to the database, types, navigation, theme or the student screens. No new settings, pages, dark theme or analytics.
- Range checks on latitude and longitude (older, already noted).

## Ideas for later
- Latitude and longitude range checks (-90 to 90, -180 to 180).
- A picker of universities for each commute row, fed by the "Close to" list, instead of typing the name.
- (Added at the end) The commute row already offers the "Close to" universities as quick picks; a full picker is still open.

## Codex review
Round 1: VERDICT FINDINGS(1).
1. MAJOR, `EditResidenceScreen.tsx`: if loading an existing listing failed, the form still opened with empty values and treated every new-field group as changed, so a save could blank stored bills, deals, housemates and commutes. **Fixed**: a failed load now shows an error with a Go back button and no form.

Round 2: VERDICT PASS.

## Verification
- `npm run typecheck`, `npm run lint`, `npm test` (68 tests, 18 new for the listing checks), `npx expo-doctor` (21/21) and `npx expo export --platform web` pass.
- The app bundle starts on port 8083 and the login screen renders without console errors. The admin form is not reachable in demo mode, so its look and the real save were not checked in a browser; the real save needs the live database (Chief Architect).
- The dark theme version of the admin screens once the oxblood dark palette is designed.
