# Plan: fix saving of preferences and the housemate card (found by the real-accounts test)

Branch: `fix/own-row-save`.

## The bug
The owner asked for the real-accounts test of Housemates. With four temporary accounts signing in through the real API, saving a student's private preferences and their housemate card failed with "permission denied". The app saved them with a database "upsert", which also rewrites the `user_id` column; students are (correctly) not allowed to change that column. My earlier database tests used separate insert and update statements, so they missed it. Without this fix no student could have saved a card or their budget.

## Fix
New `src/lib/ownRow.ts` (`saveOwnRow`): update the student's own row, insert it if there is none. Used by Edit profile (private preferences) and the housemate card save. No database permission is loosened.
Also: the board's tag chips use a position-based key, so a stored duplicate tag cannot break the list.

## Verification
1. typecheck, lint, 114 tests pass.
2. **Real-accounts test against the live database** (four temporary accounts created through the real sign-up API and a test whole home; all deleted afterwards): **42 of 43 checks pass.** Checked: saving preferences (insert and update paths); publishing a card tied to a whole home; it starts pending and is invisible; the team queue lists it with the private fields and approving works; a women-only student sees the card with the home name and spots; the home count; filtering by home; a man does not see a women-only card; a woman does; gender and budget cannot be read from public profiles; a student reads only their own private row, no one else's cards, and cannot edit another's private fields, approve their own card, call the review or queue functions, or make themselves admin; a 281-character note is refused; editing an approved card sends it back to pending and it vanishes from the board until re-approved; Say hi creates a message request the other person receives and accepts, and a second request to the same person is refused; blocking hides both sides; switching a card off removes it; a signed-out visitor cannot use the board or read private fields or gender.
3. The one miss: the database allows a duplicate lifestyle tag stored by a hand-made request (the app refuses it). Harmless (display only, now handled); not worth another database change.
4. Cleanup verified: 0 test accounts, cards, homes, blocks or conversations left; counts back to what they were. The saved test passwords file was deleted.
5. Not tested: a phone, and the screens themselves against real accounts (the test used the same calls the screens make).
