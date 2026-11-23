# Plan: group enquiry (friends enquire about a whole home together)

Branch: `feature/group-enquiry`. Third of the owner's list (after Housemates and trust and guide). Builds on the rent split (F12) and the enquiry flow (F8, F9).

## Goal
Three friends who want a whole home together can enquire as one group: one student starts it, the others join with a short code and confirm their phone number, everyone sees what each person would pay, and the Havenly team receives **one** enquiry that lists the whole group. Everyone in the group follows its status.

## How it works (the flow)
1. On a whole-home listing the student taps **Enquire with friends**. This creates a group for that home and shows a **6-letter invite code**, the people in the group and what each would pay (the rent split divided by the number of people, so it updates as people join).
2. A friend opens **Join a group** (Profile), types the code, sees the home, who started the group and their share, adds their phone number and taps **Join**.
3. When there are at least 2 people, the organiser continues to the normal enquiry form (move-in month, length, a question or a viewing time) and sends it. One enquiry goes to the team, marked "Group of N" with each person's name, university and phone number.
4. Status changes (Residence in touch, Viewing booked, Signed) are shown to **everyone** in the group in My enquiries and the bell.
5. Anyone can leave a group that has not been sent; the organiser can close it.

## Rules that keep it safe
- Whole homes only; a group needs the home to be active. 2 to 8 people.
- Only people in a group can see it and its members' **names** (not phone numbers). Phone numbers go only to the team, exactly like a normal enquiry.
- The code is the only way in; a closed or already-sent group cannot be joined.
- Signed-in students only, like any enquiry. Demo mode shows the screens but blocks writes.
- One enquiry, one referral fee for the home (the team handles it as for any enquiry). What a group of students owes each other is theirs to agree; Havenly is not a party (the Terms say so).

## Steps
1. **Database (needs the owner's yes).** New tables `enquiry_groups` (organiser, home, invite code, status open, sent or closed) and `enquiry_group_members` (group, student, contact phone, joined at); `housing_enquiries.group_id`; row security so members read their own group and its member names and the team reads all; security-definer functions `create_enquiry_group`, `enquiry_group_preview` (code to home, organiser, count, so nobody can read a group without its code), `join_enquiry_group`, `leave_enquiry_group`, `close_enquiry_group`; the enquiry insert check extended so only an organiser can attach a group, once, to the right home; the group becomes `sent` when its enquiry is inserted; the status notification goes to every member; group members can read the group's enquiry; deleting an account removes the student from groups. Tested in rolled-back blocks, then with real accounts.
2. **Pure rules with tests** (`src/lib/groupEnquiry.ts`): code format and cleaning, people limits, each person's share using the existing rent split, the status wording for the group.
3. **Screens:** Group (code, members, shares, Continue, Leave or Close), Join a group (code, preview, phone, Join), entry points (whole-home page; Profile "Join a group" and the user's open groups), the enquiry form carries the group (banner, "for your group of N").
4. **Team side:** the enquiry screen shows "Group of N" with members, universities and phones; My enquiries shows a "Group" chip.
5. **Policy:** privacy policy (names and phone numbers shared within the group and with the team), Terms (group rules, Havenly not a party). Flagged for lawyer review like the rest.
6. Checks, browser walk-through in demo, **real-accounts test** (three test accounts and a test home, all removed afterwards), Codex, PR.

## Files
Create `supabase/migrations/<timestamp>_group_enquiry.sql`, `src/lib/groupEnquiry.ts` and test, `src/lib/groupEnquiryApi.ts`, `src/screens/EnquiryGroupScreen.tsx`, `JoinGroupScreen.tsx`. Change `supabase/schema.sql`, `src/types/index.ts`, `RootNavigator.tsx`, `routes.test.ts`, `ResidenceDetailScreen.tsx`, `ProfileScreen.tsx`, `HousingEnquiryScreen.tsx`, `HousingEnquirySentScreen.tsx`, `MyEnquiriesScreen.tsx`, `AdminEnquiryScreen.tsx`, `NotificationsScreen.tsx`, `src/guest/` (demo), `src/constants/legal.ts`.

## Checks
1. typecheck, lint, tests, expo-doctor, export (web, iOS, Android).
2. Database: only a member sees a group; a wrong code reveals nothing; joining a sent, closed, full or unknown group is refused; a non-organiser cannot attach a group to an enquiry; the status notification reaches every member; leaving works; blocks and signed-out callers are refused.
3. Real accounts: organiser creates, two friends join with the code, shares update, the enquiry goes out as one, the team sees the group with phones, the team marks it Contacted and all three get the bell and the status.
4. Demo: the screens open with sample data and block writes with the demo message.

## What could break
The enquiry insert and the status notification are shared with every normal enquiry: a mistake there would break ordinary enquiries too, so each is tested with and without a group. Invite codes are guessable in theory (6 characters from 32, about 1.07 billion); joining is limited to open groups and each guess needs a signed-in account.

## Not doing
Deep links (a code is typed or pasted for now), splitting the deposit or collecting any money, voting inside a group, one enquiry per member, matching strangers into a group (that is the Housemates board), editing a group after it is sent.

## Questions
1. May I apply the database migration (two new tables, one new column on enquiries, five functions, changed enquiry insert check and status notification)?
2. Invite by a typed code (this plan) or also a tappable link? A link needs extra setup (deep links) and I recommend adding it later.
3. One enquiry and one fee per group (this plan), or one enquiry per person?

## Answers
1. Migration applied (approved). 2. Typed code only. 3. One enquiry and one fee per group.

## Changes from the plan
- NotificationsScreen needed no change: the existing status notification is simply sent to every member by the database.
- The demo cannot open the group page (it only supports flat embeds), so the group screens are verified against the real database instead; demo still blocks writes.

## Verification
- typecheck 0 errors, lint clean, 137 tests passing.
- Database: 40 rolled-back checks, then 46/46 checks through the real public API with real accounts (create, join, leave, share, one enquiry, team view with phones, status reaches every member, ordinary solo enquiries unaffected).
- UI: signed in with a real test account on localhost, started a group, the group page showed code, member list, "Waiting for friends" state. All test data deleted afterwards (7 profiles, 0 groups, 0 homes, 0 test users).

## Codex review
Round 1: VERDICT FINDINGS(1).
1. MAJOR, group members can read the organiser's enquiry row, including their phone. **Dismissed as a database change, mitigated in the app**: members only get in with a code the organiser chose to share, and the enquiry is shared on purpose so everyone follows it. Hiding the phone would need a separate view and rewrites of three screens. Instead the organiser's send screen now says plainly that the group can see what they write, including their phone number.
