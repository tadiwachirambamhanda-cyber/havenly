# Plan: F1, listing kind, costs, Verified mark and permit number

Branch: `feature/f1-listing-fields`. Brief: `docs/prd.md`, `docs/feature-list.md`.

## Goal
The Havenly team can record, for every listing, what kind of place it is, how many bedrooms a whole home has, the deposit and one-time fees on top of rent, whether Havenly has checked it ("Verified"), and an optional advert permit number. Nothing changes yet for students; F3 shows these on the listing page and F5 filters by them.

## Feature
**F1.** Done check: as admin I open Manage housing, edit a listing, set the kind to "Private room", add a deposit of AED 1,000 and turn on Verified. I save, reopen it, and all three are still there.

## Steps
1. **Database.** One new migration, `supabase/migrations/20261118100000_listing_fields.sql`, adds to `residences`: `listing_type` (student residence, shared room, private room, studio, whole home; default student residence so every existing listing stays valid), `bedrooms` (1 to 3, only for a whole home, empty for every other kind), `deposit_aed`, `move_in_fee_aed` (both whole AED, 0 or more, empty means none), `is_verified` (default false), `verified_at`, `permit_number` (up to 40 characters). Check constraints enforce those rules in the database, not only in the form. Run result: the columns exist and the existing listings read as student residence, not verified.
2. **Save function.** The same migration replaces `save_residence` so it stores the new fields. A request from an older app that does not send them still saves, using the defaults. `verified_at` is set when a listing becomes verified and cleared when it stops. Only admins can call it (unchanged). `supabase/schema.sql` gets the same changes.
3. **Types and helpers.** `src/types/index.ts` gets the new fields on `Residence` and a `ListingType` type. A new `src/lib/listing.ts` holds the five kind names and one `checkListingFields(...)` function that validates and cleans the form values (bedrooms only for a whole home, 1 to 3; amounts are whole numbers and not negative; permit trimmed and length-checked). It has its own unit tests.
4. **Admin form.** `src/screens/EditResidenceScreen.tsx` gets: "Kind of place" chips; "Bedrooms" chips (1, 2, 3) shown only for a whole home; "On top of rent" with Deposit and One-time fees (AED); a "Verified by Havenly" switch with the hint "Turn on only after the team has checked this place"; an optional "Advert permit number". Screen title and labels say "listing" instead of "residence". It sends and loads the new fields.
5. **Demo mode.** `src/guest/fixtures.ts` gets the new fields on its sample listings so the demo still works (all sample, none verified).
6. **Checks and live test.** Run typecheck, lint, tests and the web export. After you approve the database change (see Questions), apply the migration, then test in the browser with a throwaway admin account that I delete afterwards.

## Files
- Create: `supabase/migrations/20261118100000_listing_fields.sql`, `src/lib/listing.ts`, `src/lib/listing.test.ts`.
- Change: `supabase/schema.sql`, `src/types/index.ts`, `src/screens/EditResidenceScreen.tsx`, `src/guest/fixtures.ts`.

## Checks
1. `npm run typecheck`, `npm run lint` and `npm test` pass, including the new tests: a whole home needs 1 to 3 bedrooms; any other kind drops bedrooms; a negative or fractional deposit is refused; a long permit number is refused.
2. `npx expo export --platform web` passes.
3. In the database after the migration: the new columns exist; every existing listing is "student residence", no bedrooms, not verified; trying to insert a whole home with no bedrooms, or a studio with 2 bedrooms, is refused (tested inside a transaction that is rolled back).
4. Database permissions are unchanged: listings can still only be changed by admins (policy list checked), and `save_residence` is still not callable by signed-out visitors.
5. In the running web app, as a throwaway admin: I edit an existing listing, set Private room, deposit AED 1,000, Verified on, save, reopen, and all three are there. I add a new "Whole home" with 3 bedrooms and see it appear in the Housing list. I try to save a home with no bedrooms and get a clear message. I edit an existing listing without touching the new fields and it saves as before. The Housing list and listing page look exactly as they did.
6. Throwaway admin account and test listing are deleted afterwards.

## What could break
The riskiest step is replacing `save_residence`: if it is wrong, no listing can be saved in Manage housing. It is one transaction, it keeps working for requests without the new fields, and I test an unchanged save on an existing listing right after applying it. Second risk: the database change goes live before the new screen does, so the migration is written to be safe for the current live app, which keeps working untouched.

## Not doing
- Showing kind, deposit, bedrooms, per-person rent or the Verified mark to students (F3); filters and sorting (F5); listing-type labels on the Housing cards (F3/F5).
- Provider accounts or a provider table. Each listing keeps its provider name as text; a provider link is added when agents and residences get logins.
- Renaming the `residences` table or the screens' file names.
- Any change to who can see or edit listings, to enquiries, or to the referral-fee terms.

## Questions
1. **Database change on the live project:** the migration only adds columns with safe defaults, and the live app keeps working while it runs. OK to apply it to the live Supabase project when we reach step 6?
2. **Names of the five kinds:** Student residence, Room in a shared apartment, Private room, Studio, Whole home. Change any?
3. **Extra costs:** I plan two amounts on top of rent, Deposit and One-time fees (agency or admin fee). Is that enough for now, or do you also want a separate field for something else (for example a commission)?
