# Plan: a Saved list for hearted places

Branch: `feature/saved-list`. Written by the Chief Architect (navigation and shared files). Follows F7 (save listings) and the owner's request after the social removal.

## Goal
A signed-in student taps the **Saved** tab and sees every place they hearted, with price, bills, commute and a heart to remove it. Compare goes back to being opened from Housing (and from a button on Saved).

## Steps
1. New `src/screens/SavedScreen.tsx`: loads the student's `saved_residences` with the active listings, newest save first; one row per place (photo, name, kind and area, price, bills tag, student deal tag, commute); heart removes it (with undo-safe rollback if the request fails); tap opens the listing; "Compare" button with the count of places chosen to compare; loading, empty ("Nothing saved yet" with a Find a place button) and error states.
2. Tabs: replace the `CompareTab` tab with `Saved` (heart icon). `CompareScreen` goes back to being a normal stack screen (back arrow, back button on its empty state); the tab-only tweaks are removed.
3. Update the dead-link test's expected routes (`Saved` in, `CompareTab` out) and add a unit test for the row ordering and the "bills" line helper if new logic is added.
4. Checks and a tap-through in the demo (hearting a place on Housing, then opening Saved).

## Files
Create `src/screens/SavedScreen.tsx`. Change `src/navigation/RootNavigator.tsx`, `TabBar.tsx`, `src/screens/CompareScreen.tsx`, `src/navigation/routes.test.ts`, `docs/archive/social.md` (tab list line), `plans/`.

## Checks
1. typecheck, lint, tests, expo-doctor, web export pass.
2. In the demo: heart two places on Housing, open Saved: both are listed, newest first; remove one: it disappears and is gone from the heart on Housing; empty state shows when none; tapping a row opens the listing.
3. Housing's "Saved" filter chip still works. Compare opens from Housing and from the button on Saved, with a back arrow.
4. A failed removal (network off) puts the place back and shows a message.

## What could break
The Compare tab removal: anything that navigated to the tab (`CompareTab`). The dead-link test checks this.

## Not doing
Folders or notes for saved places, sorting options, sharing a saved list, price-drop alerts.

## Questions
None.

## Verification
1. typecheck, lint (no warnings), 93 tests (3 new for the ordering), expo-doctor 21/21 and the web export pass.
2. Demo with two sample saved places seeded temporarily (restored afterwards; demo mode blocks real saving): Housing showed both hearts filled; Saved listed both, newest first, with price, bills, deal tag and commute; tapping a row opened the listing; tapping the heart with writes blocked put the row back and showed "Couldn't remove it from your saved list".
3. Not tested: saving and removing against a real account on the live database (same `setResidenceSaved` call Housing already uses), and a phone.

## Codex review
Round 1: VERDICT FINDINGS(2).
1. MAJOR, `SavedScreen.tsx:54-58`: after a failed reload the old rows (and the header count) stayed. **Fixed:** a failed load clears the rows, so the error screen shows "0 places" instead of a stale number.
2. MINOR, `routes.test.ts`: nothing stopped the removed `CompareTab` from coming back. **Fixed:** it is now in the list of routes that must be absent.
