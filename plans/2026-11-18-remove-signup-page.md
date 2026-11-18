# Plan: remove the Create an account page

Branch: `feat/remove-signup-page`. Chief Architect, at the owner's request.

## Goal
One place to make an account: the sign-in sheet. The separate "Create an account" screen is gone.

## Steps
1. Delete `SignUpScreen.tsx` and its route (`SignUp`) from both signed-out navigators.
2. Login's "New to Havenly? Create an account" link opens the sign-in sheet with a new reason, `join` ("Make a free account / So you can save places, send enquiries and join in").
3. Register the sheet in the plain signed-out navigator too, so the link works whatever the public-browsing switch says.

## Files
`src/screens/SignUpScreen.tsx` (deleted), `src/navigation/RootNavigator.tsx`, `src/screens/LoginScreen.tsx`, `src/screens/SignInToContinueScreen.tsx`, two stale comments.

## Checks
typecheck, lint, 85 tests, expo-doctor, web export; Login's link opens the sheet.

## What could break
Anything that still pointed at `SignUp`. Searched: only Login's link and the navigator did.

## Not doing
Changing the sheet's look, the demo banner, or the password rules (the sheet already uses the same rules and the same terms links).

## Verification
typecheck, lint and 85 tests pass. On screen: Log in, then "Create an account", opens "Make a free account" with email, password, Create account, "I already have an account. Log in" and Not now.

## Codex review
Round 1: VERDICT PASS (no findings).
