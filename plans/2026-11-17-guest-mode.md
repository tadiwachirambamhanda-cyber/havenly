# Plan: guest mode

Branch: `feat/guest-mode`. Brief: `docs/guest-mode-brief.md`.

## Approach
Screens call `supabase` directly in about 50 places, so rewriting them is risky. Instead, `src/lib/supabase.ts` exports a **switching client**: while guest mode is on it forwards every call to an in-memory **demo client**; otherwise to the real client. The demo client answers reads from bundled fixtures and refuses every write. Screens stay unchanged.

## Steps
1. `src/guest/guestState.ts`: in-memory on/off flag with subscribe. Test.
2. `src/guest/fixtures.ts`: made-up sample data (profiles, posts, comments, communities, events, residences and rooms, brands, offers). Test: nothing looks real.
3. `src/guest/demoClient.ts`: query builder over the fixtures (select, embedded relations, eq, neq, in, is, ilike, contains, or, not, gte/lte, order, limit, range, single, maybeSingle, head counts), writes blocked, rpc blocked, Realtime stubs, Auth and Storage stubs. Tests for reads and for every write path.
4. `src/guest/clientSwitch.ts` and `src/lib/supabase.ts`: Proxy that picks demo or real per call. Test with a fake real client that fails the test if touched in guest mode.
5. `AuthContext`: `isGuest`, `enterGuest`, `exitGuest`; in guest mode expose a fake session and guest profile (the real session state is untouched).
6. UI: "Explore without signing up" on the sign-in screen; `GuestBanner` while in the demo.
7. Tests (vitest) and the `npm test` script, added to CI.
8. Migration file for the Supabase scan findings (revoke signed-out access to the 28 functions), not applied.
9. Run the app on web in guest mode, try every main screen and every write button, screenshot.
10. Independent Codex review, then fix or answer each finding. Open the pull request.

## Checks
`npm run typecheck`, `npm run lint`, `npm test`, `npx expo export --platform web`.

## What could break
- A screen expects a column or relation the fixtures lack: it shows an empty state or an error message. Step 9 finds these.
- The fake session leaks into logging: crash reporting uses the real session only.

## AI and sending
No AI. Nothing is sent anywhere in guest mode.

## Codex review
Round 1: VERDICT: PASS, no findings. Codex read the guest files, the auth and client wiring, and the migration.
Own check on the migration: no row-level policy and no other function references the 24 functions it restricts (read-only query), so applying it should not break the signed-in app. Not applied: needs the owner's approval.
