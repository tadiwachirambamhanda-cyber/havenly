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
