# Plan: labelled sample listings

## Goal
The live app is not empty before real listings arrive: six clearly labelled sample places that students can browse and save, but never enquire about.

## Feature
Owner decision 2026-11-27 ("labelled samples now … fake nice listings", "No, show 'Sample'"). Bridges F10 (real listings) until the founder's places arrive.

## Steps
1. Migration `20261127100000_sample_listings.sql`: `residences.is_sample`; enquiries and group enquiries on a sample are refused by the database; samples never send alerts.
2. `scripts/sample-listings/seed.sql`: six samples (Knowledge Park residence, Al Barsha private room, Silicon Oasis studio, JLT 3 bed home, Academic City shared room, Marina 2 bed), every name starting "Sample", description "Sample, not a real place … Photos from Unsplash, for illustration only", not Verified, provider "Sample Housing Partner". Photos: Unsplash free licence only, linked from Unsplash, no landmark shots.
3. App: a "Sample" tag on cards, Saved and the listing page; on a sample the Enquire button is replaced by "This is a sample listing to show how Havenly works, so enquiries are off"; no "Enquire with friends".
4. `scripts/sample-listings/remove.sql` removes them all when real listings are live.

## Verification
- Rolled-back test `scripts/db-tests/sample_listings.py`: 10/10 (6 seeded with 7 rooms; signed out sees them; a student can save but not enquire or start a group; the team's save works and sends no alerts; the flag survives a save; remove clears them).
- Applied live; seed added 6. Signed out at 390 wide: Housing shows "6 places" with photos and the Sample tag; a sample's page shows the description and the "enquiries are off" note instead of Enquire.
- typecheck, lint, 193 tests pass.

## Not doing
Real listings (the founder's), removing demo mode (after real listings).
