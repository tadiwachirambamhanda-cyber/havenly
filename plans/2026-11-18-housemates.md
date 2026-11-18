# Plan: Housemates, a board where students find people to live with

Branch: `feature/housemates` (stacked on `feature/profile-housing`, PR 36; rebased onto main once that is merged). Written by the Chief Architect. First of the four features the owner chose (Housemates, then trust and guide, then group enquiry, then alerts; each gets its own plan).

## Goal
A student can switch on a "looking for housemates" card, and other students can browse cards, see only the people each side is happy to live with, and say hi. A card can be tied to a whole home ("2 spots left").

## Feature
New (F14). Done check: I switch my card on after the team approves it; a student whose preference is "women only" sees my card only if I am a woman who accepts them; I tap Say hi and a message request reaches them; on a whole-home listing I see how many students are looking for housemates for it.

## How matching and privacy work
- **Who sees whom (the owner's rule):** each side's choice is respected both ways. Two optional profile fields drive it: `gender` (woman, man, or not given) and the existing `housemate_pref` (anyone, women only, men only). A card is shown to a viewer only if the owner's preference accepts the viewer's gender **and** the viewer's preference accepts the owner's gender. Someone who gives no gender only sees and is seen by "anyone" cards. This is enforced in the database, not in the app.
- **What a card shows:** the display name the student chose, university, budget, move-in month (both from their saved preferences), area, up to 5 lifestyle tags, a 280-character note, gender (if given), and the home and spots if tied to one. **Never** a phone number, email or last name unless they put it in their display name. Others cannot read the table directly, only the filtered board function.
- **Contact:** Say hi uses the existing message-request chat (the other person accepts or declines). Block and report already exist (reports use the `user` target).
- **Safety:** off by default, 18+ (terms), cards go live only after the team approves them, a decline or block hides each side from the other, deleting an account deletes the card.

## Steps
1. **Database (needs the owner's yes).** `profiles.gender` (optional, `female` or `male`, update grant added). New table `housemate_cards` (one per user: status `pending`/`approved`/`hidden`, `active`, area, lifestyle array limited to a fixed list and 5 items, note up to 280, optional `residence_id` of a whole home, `spots_needed` 1 to 5, timestamps), row security so a student can only read and edit their own, a `housemate_board(...)` function returning the approved, active, mutually compatible cards (not yours, no blocks either way) with filters (university, max budget, move-in month, area, home), a `housemates_for_home(residence)` count, and team-only approve and hide. Run: tested in rolled-back blocks (compatibility both ways, blocks, unapproved hidden, no direct reads of others' rows, a user cannot approve their own card).
2. **My card screen.** Switch, area, lifestyle chips, note, optional gender (explained: used only to match housemate preferences), preferences link to Edit profile; publish requires budget and move-in month; shows "Waiting for approval", "Live" or "Hidden by the team". Run: browser.
3. **Board screen.** Filters (my university by default, budget, month, area), card list with loading, empty and error states, **Say hi** (starts the message request), report and block on each card. Entry: a people icon on the Housing header and a card on Profile.
4. **For a home.** On a whole-home listing page: "Find housemates for this home" opens My card tied to it, and "N students are looking for housemates here" opens the board filtered to it.
5. **Team queue.** A Pending housemate cards screen for the team (approve or hide with a reason), reachable from Settings under Havenly team.
6. **Policy.** Privacy policy section (card content, gender used only for matching, visible to other signed-in students, deleted with the account); Terms housemate rules (18+, friends taking a whole home on one lease, no bed-space letting, no soliciting). **Both marked for UAE lawyer review before launch.**
7. Checks, browser walk-through, Codex, PR.

## Files
Create `supabase/migrations/<timestamp>_housemates.sql`, `src/lib/housemates.ts` (+ test: lifestyle list, note and spots validation, compatibility rule mirrored for the demo), `src/screens/HousemateBoardScreen.tsx`, `MyHousemateCardScreen.tsx`, `src/screens/admin` review screen (`HousemateReviewScreen.tsx`). Change `supabase/schema.sql`, `src/types/index.ts`, `src/navigation/RootNavigator.tsx`, `routes.test.ts`, `HousingScreen.tsx` (icon), `ProfileScreen.tsx` (card), `EditProfileScreen.tsx` (gender), `ResidenceDetailScreen.tsx` (for a home), `SettingsScreen.tsx` (team link), `src/guest/` (demo sample cards), `src/constants/legal.ts`.

## Checks
1. typecheck, lint, tests, expo-doctor, export (web, iOS, Android).
2. Database tests inside rolled-back blocks, as listed in step 1.
3. Demo: switch a card on, see sample cards (demo is read-only for writes), filters, Say hi blocked with the demo notice.
4. Real accounts (two test accounts and a test home on the live database, removed afterwards, with the owner's yes): a woman-only seeker and a man cannot see each other; approval makes a card appear; Say hi creates a request; block hides.

## What could break
The visibility rule is the whole feature: a mistake would show a card to someone it should not be shown to. It lives in one database function with tests for every combination, and the table cannot be read directly. Second risk: the chat request flow was built for the old social profile; it needs a Say hi starter that does not rely on the removed user profile screen.

## Not doing
Compatibility scores or swiping, photos on cards, verifying students by university email (planned next, noted in the policy as "coming"), group chats for housemates, any payment. Bed-space or sublet adverts are out by design (Dubai's 2026 shared-housing law).

## Questions
1. May I apply the migration (new table, one new profile column) to the live database?
2. Cards go live only after the team approves them (my recommendation), or instantly with report and hide after the fact?
3. Gender is an optional profile field used only for matching, and shown on the card if given: OK?
4. Please merge PR 36 first; this feature uses the budget and move-in month saved there.

## Changes from the plan
- The owner approved: apply the migration, team approval before a card goes live, an optional gender field. PR 36 was merged first. Migration `20261118500000_housemates.sql` was applied live and recorded with `supabase migration repair`.
- A new sign-in reason `housemates` ("Make a free account to find housemates"). The `join` copy lost its "join in" social wording.
- The demo answers the board with two sample cards (reads only; Say hi and publishing stay blocked as in all demo writes).
- Edit profile's gender and the card screen explain the matching in plain words (`visibilityExplainer`), including the case where someone prefers one gender but has not given their own (nobody sees them, and they see no one).
- The My card screen scrolls to its error at the top, because the Publish button is at the bottom of a long form.

## Verification
1. typecheck, lint (no warnings), 114 tests (12 new for card rules and wording), expo-doctor 20/20, export for web, iOS and Android pass.
2. **Matching tested live in a block that rolled back** with six test users (woman women-only, man anyone, woman anyone, no gender anyone, a second woman, man men-only), every viewer in turn: a women-only woman sees only women who accept her; a man sees men and "anyone" women; a student with no gender sees and is seen only by "anyone" cards; the men-only student sees only the man. Also verified: a student reads only their own row of the table; cannot set status; cannot approve; editing an approved card sends it back to pending; a block hides both sides; inactive and hidden cards vanish; filters; a signed-out caller cannot call the board; a live card needs budget and move-in month; more than 5 tags, an unknown tag, a note over 280 characters and a card tied to a non-home are refused. Afterwards: 0 test users, 0 cards.
3. Browser demo: signed-out Find housemates opens the sign-up sheet with the new wording; the board shows sample cards with filters, Report, Block, and Say hi is blocked with the demo message; My card shows the form, the explainer and the switch; a whole-home page shows "1 student is looking for housemates here" and opens the board.
4. Not tested: real accounts end to end (two test accounts, a test home and an approval), a card tied to a real whole home (there are no listings), and a phone.
