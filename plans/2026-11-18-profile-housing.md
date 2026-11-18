# Plan: a housing Profile (first pass)

Branch: `feature/profile-housing`. Owner picked all four: housing preferences, enquiry status up front, cleaner layout, account tools. First pass, then adjust after trying it on a phone.

## Goal
A signed-in student opens Profile and sees who they are, where their enquiries stand, what they are looking for, and can manage their account, without the old social look.

## Feature
Follows F8 (follow an enquiry's status) and the housing pivot. Done check: on Profile I see my latest enquiries with their status, set a budget and a move-in month once and find them pre-filled when I enquire, change my password, and log out or delete my account from Profile.

## Steps
1. **Database (needs the owner's yes).** One additive migration `profiles`: `budget_aed int` (null, 1 to 100000), `move_in_month date` (null, must be the first of a month), `housemate_pref text` (null, one of `any`, `female_only`, `male_only`), and extend the update grant on `profiles` to those three columns. Nothing existing changes. Run: applied inside a rolled-back test first, then live.
2. **Layout.** Profile header becomes avatar, name, university, Edit profile, gear; no cover photo (and "Change cover" leaves Edit profile; the stored cover stays in the database).
3. **Enquiries up front.** A section on Profile with the latest 3 enquiries (place, kind, status chip, how long ago) and "See all" to My enquiries; empty state "No enquiries yet" with a Find a place button. The unread dot moves to this section's header; the separate Notifications row stays.
4. **Housing preferences.** A summary card on Profile ("Up to AED 3,000 · from September 2026 · mixed") with an Edit button opening a section in Edit profile: monthly budget, move-in month (next 12 months), who I'd live with (Anyone, Women only, Men only). The enquiry form starts with the saved budget and move-in month (phone already pre-fills from the last enquiry).
5. **Account tools.** New Account section on Profile: email shown (read only), **Change password** (new screen, signed-in only, same password rule as sign-up), Log out and Delete account (moved here from Settings; Settings keeps Appearance, Blocked accounts, Legal and the team rows). Demo mode shows these as blocked, as everywhere.
6. **Policy.** Add budget, move-in month and housemate preference to the privacy policy's profile line.
7. Checks, browser walk-through (demo), Codex, PR.

## Files
Create `supabase/migrations/<timestamp>_profile_housing_preferences.sql`, `src/screens/ChangePasswordScreen.tsx`, a small `src/lib/profilePrefs.ts` (formatting and validation, with tests). Change `src/screens/ProfileScreen.tsx`, `EditProfileScreen.tsx`, `SettingsScreen.tsx`, `HousingEnquiryScreen.tsx`, `src/navigation/RootNavigator.tsx`, `src/navigation/routes.test.ts`, `src/types/index.ts`, `supabase/schema.sql`, `src/guest/fixtures.ts` (demo profile fields), `src/constants/legal.ts`.

## Checks
1. typecheck, lint, tests (new: preference validation and summary line), expo-doctor, export.
2. Migration: refused values (negative budget, a mid-month date, a bogus preference) inside a rolled-back block; an existing profile update still works; applied live only after the owner's yes.
3. Demo: Profile shows the new header, an enquiries section, the preferences card and the account rows; Edit profile has the preferences and no cover; Settings has no Log out or Delete.
4. A real account (test account, removed afterwards, with the owner's yes): save preferences, reopen, enquire and see them pre-filled; change password and log in with the new one.

## What could break
The profile update grant: if a column is missing from it, Edit profile saves fail. Moving Log out and Delete out of Settings: anyone who looks for them there. Password change needs a recent sign-in on some accounts: the screen shows a plain "log in again" message if refused.

## Not doing
Changing the email address (needs the email confirmation flow), photos upload changes, public profiles, preferences driving search filters or ranking, a profile-completeness meter.

## Questions
1. May I apply the migration to the live database (step 1)? It only adds three empty columns.
2. Move Log out and Delete account from Settings to Profile (my recommendation), or keep them in both places?

## Changes from the plan
- The owner approved the migration and moving Log out and Delete account. The migration `20261118400000_profile_housing_preferences.sql` was applied live on 2026-11-18 and recorded with `supabase migration repair`.
- Edit profile gets a Save button at the bottom as well as the header (the form is now long), and its error message shows at the top, under the header, instead of at the bottom.
- The "Delete your account?" warning now says profile, saved places, enquiries and messages (it still said posts and comments).
- The Notifications row moved into the Account section; the new-update dot is on both My enquiries and that row.
- The real-account test (plan check 4) was not run: it needs a test account on the live database and the owner's yes.

## Verification
1. typecheck, lint (no warnings), 102 tests (9 new for budget parsing, the summary line and the saved move-in month), expo-doctor 20/20, export for web, iOS and Android pass.
2. Migration, tested live inside blocks that rolled back: a negative, zero or over-limit budget, a mid-month date and a bogus preference are all refused; valid values and nulls are accepted; as the signed-in role, a profile can write the new columns and `is_admin` is still locked.
3. Demo in the browser: Profile shows the new header, enquiries (empty state, and with two seeded sample enquiries the rows and status chips), the preferences card, the Account section; Edit profile has no cover, shows the preferences, refuses a bad budget with the message at the top; Change password opens with the demo notice and a disabled button; Settings has no Log out or Delete.

## Codex review
Round 1: VERDICT FINDINGS(4).
1. MAJOR, `HousingEnquiryScreen.tsx:40-43`: the profile budget is per month but the enquiry form's budget is per year (the team sees "/ year"), so pre-filling 3000 would have sent AED 3,000 a year. **Fixed:** the pre-fill is the monthly budget times 12. (The enquiry form asking per year while the rest of the app is monthly is an older mismatch; flagged to the owner.)
2. MAJOR, `ProfileScreen.tsx:53-65`: profile and enquiries stayed in local state across an account change. **Fixed:** loaded data is tagged with its account and never shown for another one.
3. MINOR, `HousingEnquiryScreen.tsx:69`: the discard guard only looked at message and budget. **Fixed:** it now covers move-in month, length, room, viewing time, kind and phone (a phone filled in from the last enquiry does not count as a change).
4. MINOR, `legal.ts:71,80`: the policy still said account deletion is in Settings. **Fixed:** it says Profile.

Round 2: VERDICT FINDINGS(3), all minor.
5. `ProfileScreen.tsx:66-74`: an older profile load could overwrite a newer one. **Fixed:** only the latest request updates the screen, and a missing profile always shows the loading placeholder.
6. `legal.ts:151`: the Terms still said deletion is in Settings. **Fixed:** the one location is updated to Profile; nothing else in the Terms was touched (the rest still needs its own update).
7. `ProfileScreen.tsx:215-217`: Delete account looked active in demo mode. **Fixed:** in demo mode it shows "Demo mode: make an account to manage one."
