# Plan: three tabs (Housing, Community, Profile)

## Goal
A simpler bottom bar: students live in Housing and Community; Profile holds their own things. Saved and Messages stay in the app as screens, not tabs.

## Feature
Owner decision 2026-11-25 ("do we need 5 tabs… make the app ux simple… declutter"), choosing 3 tabs. Part of F14.

## Steps
1. Navigation: tabs Housing, Community, Profile; Saved and Inbox become screens with the same route names.
2. Tab bar: the unread-messages dot moves to Community (where Messages opens), notifications stay on Profile.
3. Messages screen gets a back button. Profile's Account card gets "Saved places" and "Messages" (with an unread dot).
4. Lanes (messaged): Lane A adds a Saved heart button to the Housing top bar and a back button on Saved; Lane C adds a Messages button with an unread dot to the Community top bar.

## Checks
Typecheck, lint, tests (a new test locks the tabs to Housing, Community, Profile and checks Saved and Inbox are screens). Demo at 390 wide: three tabs; Profile → Saved places and Messages open, Messages has a back button.

## Not doing
The declutter pass across all screens (after both lanes merge, as a list for the owner to approve).

## Verification
Typecheck 0 errors, lint clean, 150 tests passing. Demo at 390 wide: three tabs (Housing, Community, Profile); Profile → Messages opens with a back button; "Saved places" row present.
