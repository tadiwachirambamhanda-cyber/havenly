# Plan: remove the Member sign-in (login) page

Branch: `feat/remove-login-page`. Chief Architect, at the owner's request ("remove them permanently").

## Goal
No separate login or sign-up screens. The sign-in sheet is the only place to log in or make an account.

## Steps
1. Delete `LoginScreen.tsx` and its route. Housing's "Log in" now opens the sign-in sheet in log-in mode (reason `login`: "Welcome back / Log in to see your saved places and your enquiries.").
2. The recruiter demo ("Explore without signing up") lived on the login page. It moves to the sign-in sheet as "Just looking? Explore the demo", shown when the sheet is opened from "Log in" or "Create an account" (not when it is asked for by Save, Enquire or Compare).
3. Public browsing is permanent now, so the `PUBLIC_BROWSING` switch and its file are removed; there is a single signed-out navigator.

## Files
`src/screens/LoginScreen.tsx` and `src/config/features.ts` (deleted), `src/navigation/RootNavigator.tsx`, `src/screens/HousingScreen.tsx`, `src/screens/SignInToContinueScreen.tsx`, `CLAUDE.md` (folder table).

## Checks
typecheck, lint, 85 tests, expo-doctor, web export; on screen: Housing, then Log in, opens "Welcome back" in log-in mode; a wrong password shows "That email and password do not match"; "Just looking? Explore the demo" opens the demo.

## What could break
Anything that navigated to `Login`: searched, only Housing's button did. A logged-in person who logs out now lands on Housing (the signed-out start), not a login page.

## Not doing
Changing the sheet's look, password rules or the demo itself.

## Verification
As in Checks (typecheck, lint, 85 tests pass; the three on-screen checks done).
