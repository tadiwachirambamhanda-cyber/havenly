# Brief: guest mode ("Explore without signing up")

Written 2026-11-17.

## Problem
Havenly's live web build opens on a sign-in screen. Recruiters and first-time visitors rarely create an account just to look around, so they never see the product.

## What it does
A button on the sign-in screen, "Explore without signing up", opens the real app in a **read-only demo** with bundled sample content: feed, post pages with comments, Discover and events, communities, housing listings, perks, profile. A banner says "Demo mode, sample content only" and offers "Create account". Anything that would write (like, comment, follow, message, post, enquire, claim, delete account) is refused with "Create an account to do this."

## Security requirements (all must hold, each has a test)
1. **No database access in guest mode.** The real Supabase client is never called while a guest session is active: not for reads, not for writes, not for Realtime, not for Auth, not for Storage.
2. **Every write is blocked in code**, not only hidden in the UI: insert, update, upsert, delete, rpc, storage upload/remove, and every Auth call except leaving the demo.
3. **No real people's data.** All fixtures are made up. Sample accounts are marked `sample`. A test fails if a fixture profile looks real.
4. **Guest state lives only in memory.** Nothing is saved to the device; a reload returns to the sign-in screen. Leaving the demo clears it.
5. **No new database permissions.** No migration, no new policy, no new key. Guest mode works with zero changes to Supabase.
6. **The fake guest user id can never be sent to the real client**, because the real client is not used while guest mode is on (tested through the switch).
7. Separate from this feature, the Supabase security scan found 28 functions that signed-out visitors can call. A reviewed fix is included as a migration file and is **not applied** until the owner approves.

## Not in this version
- No saving anything in the demo, no demo accounts, no analytics on demo use.
- No Map screen content beyond sample places, no real photos beyond the existing public sample images.

## Done when
- A visitor can tap "Explore without signing up", browse every main screen with sample content, and cannot change anything.
- `npm run typecheck`, `npm run lint` and `npm test` pass, and the web build exports.
- An independent review has been run and each finding answered.
