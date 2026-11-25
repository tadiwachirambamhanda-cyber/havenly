# Plan: Lane C, Community (F18 to F24)

Lane C, branch `worktree-lane-c`, from main at 292def8. Brief: `docs/lanes/lane-c.md` (approved by the owner).

## Goal
A signed-in student can join university communities, read and write posts with photos and an area or listing tag, like, comment, report and block, find housemates, events and perks inside Community. The team can review reports and add events, brands and perks.

## Feature
F18 to F24 (`docs/feature-list.md`), with the lane brief's "Done means" list as the checks.

## Steps
1. **Data and rules.** `src/lib/community.ts` (pure: community order, limits, post checks, photo paths, time and Dubai date formatting, event input parsing, report reasons, the old-sample-perk filter) with `src/lib/community.test.ts`; `src/lib/communityApi.ts` (Supabase calls); `src/lib/communityPhotos.ts` (upload to the private `community-photos` store and short-lived signed links, never the public `post-images` store). Check: `npm test`.
2. **Shared pieces** in `src/components/community/`: post card (name, photo, university, time, ⋯ menu, text, photos, tag chip, like and comment pills), photo grid, report sheet (reasons from `ReportReason`), event card (berry date block, "I'm going"), perk card (sun, "Get code", code box), community card, housemate card, skeletons. Check: typecheck.
3. **Community tab (F18).** My communities (my university first as a berry card, joined ones white, "Find more" sheet with search and Join), shortcuts Housemates, Events, Perks, latest posts from joined communities, upcoming events and a perk; team tools row for admins. Loading, error and empty states. Check: web at 390 and 1440, light and dark.
4. **A community (F18, F19, F21, F22, F23).** Berry header with Join / Joined (leave with a confirm), sections Posts, Housemates (campus communities only), Events, Perks; posts with their latest comments; floating "Write a post". Housemates uses `housemate_board` for that university (same rules as today) with "Message" and "My housemate card". Profile loses its Housemates block.
5. **Writing (F19, F20).** New post sheet: Cancel, Post (disabled until there is text), community picker (joined only), text, photos up to 4, tag an area (`AREAS`) or a listing; uploading state; a failed post keeps the text. Post page: full post, all comments, comment box, delete own post or comment, report and block. Tag chip opens the listing, or Housing for an area.
6. **Events and perks (F22, F23).** Event page with Going (mint with a tick, count +1, tap again to take back) and Report. Perks list and perk page with "Get code" (same code every time). Old "Sample" perks and the Veldemers brand are left out of every student query.
7. **Team (F22, F23, F24).** Review queue: kind, "Reported N times", "Hidden by reports", where and who wrote it, text, reasons, Hide and Keep with Undo, "Nothing to review". Manage events: add, edit, delete, optional community. Manage perks: add a brand, add a perk, switch a perk off.
8. **Checks and review.** typecheck, lint, test, expo-doctor, web export; Codex review; PR.

## Files
`src/screens/` CommunityScreen, CommunityDetailScreen, CreatePostScreen, PostDetailScreen, EventDetailScreen, PerksScreen, PerkDetailScreen, ReviewQueueScreen, ManageEventsScreen, ManagePerksScreen, HousemateBoardScreen, ProfileScreen (Housemates block only); `src/components/community/*`; `src/lib/community.ts`, `community.test.ts`, `communityApi.ts`, `communityPhotos.ts`; this plan.

## Choices
- **Undo in the review queue** waits: Hide or Keep shows the result line with Undo straight away and is sent to the database after 6 seconds, or at once when the team member leaves the screen. Undo inside that window sends nothing. The database has no "reopen reports" function, so an undo after the decision has been sent cannot restore the pending reports.
- **Times**: events are entered and shown in Dubai time (UTC+4, no daylight saving), worked out by hand so it does not depend on the phone's time zone support.
- **"N new"** on a community card counts posts from the last 7 days.
- **Old sample perks**: student views leave out brands named "Veldemers" or starting with "Sample" (the 4 old perks). The team's Manage perks still lists them, marked "Hidden from students".
- **Team entry**: the Community tab shows a "Team" row (Review reports, Events, Perks) only to admins; Settings belongs to the Chief Architect.
- **Guest mode**: photo links are not asked for in the demo (the demo client refuses them).

## Checks
- `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`, `npx expo export --platform web`: all pass.
- The Done-means list in the brief, walked through on the web build at 390 and 1440 wide, light and dark (the real-accounts check is done later by the Chief Architect).

## What could break
- Posting: photos are uploaded before the post row; if the row fails, the uploaded photos are removed and the text stays.
- The housemate board screen is reused by the listing page (`{ residenceId }`): keep its param and behaviour.

## Not doing
Follows, a global feed, video, notifications for likes and comments, signed-out reading of Community, students creating communities.

## Questions (for the Chief Architect)
- Housing has no route param for an area, so tapping an area tag opens the Housing tab without the area filled in. A `Housing: { area?: string }` param (read by Lane A's HousingScreen) would finish F20's "Housing search for that area".
- Undo after a review decision has been sent would need a database function that reopens the reports.

## Handover (2026-11-25, first Lane C session)

**Done and committed** (typecheck, lint and tests green at each commit; not yet tried in a browser):
- Step 1: `src/lib/community.ts` (+ 25 tests), `communityApi.ts`, `communityPhotos.ts` (private `community-photos` store, signed links, skipped in guest mode). Old "Sample" perks and Veldemers are filtered in `fetchPerks` / `fetchPerk` (`isHiddenSampleBrand`).
- Step 2: `src/components/community/`: `ui.tsx`, `PostCard.tsx` (with `PostPhotos`, `TagChip`), `SafetyMenu.tsx` (Report with reasons, Block, Delete), `usePostActions.tsx`, `EventCard.tsx` (with `useGoing`, `DateBlock`, `GoingButton`), `PerkCard.tsx` (with `usePerkCodes`, `CodeBox`, `GetCodeButton`), `HousemateCardView.tsx`, `useHousemateActions.tsx`, `useMembership.tsx`, `FindCommunities.tsx`, `TagPicker.tsx`. HousemateBoard now uses the shared card ("Message <name>"); Profile's Housemates block is removed.
- Step 3: `CommunityScreen` (my communities with the university card first, Find more, shortcuts, team row for admins, latest posts with an event and a perk, Messages button with the unread dot next to Post: owner's request of 2026-11-25).
- Step 4: `CommunityDetailScreen` (berry header, Join/Joined with leave confirm, Posts/Housemates/Events/Perks, floating Write a post).
- Step 5 (half): `CreatePostScreen` done. **`PostDetailScreen` is not built yet** (still the placeholder).

**Left to do**
1. Merge `origin/main` (three tabs; Inbox is now a stack route) and change `navigation.navigate('Inbox' as never)` in CommunityScreen back to `navigation.navigate('Inbox')`, removing the comment.
2. `PostDetailScreen` (`{ postId }`, Lane A opens it): full post via `PostCard full`, all comments (`fetchComments([id])`), comment box (`addComment`, `commentProblem`), comment ⋯ menu through `useSafetyMenu` (type 'comment', Delete own via `deleteComment`), a not-found state when the post is hidden or deleted.
3. `EventDetailScreen` (`DateBlock large`, `eventWhen`, location, description, `GoingButton` via `useGoing`, Report via `useSafetyMenu`), `PerksScreen` (list of `PerkCard`), `PerkDetailScreen` (`fetchPerk`, `CodeBox` / `GetCodeButton`, address, end date).
4. Team screens: `ReviewQueueScreen` (deferred Hide/Keep with Undo as in Choices: 6 s timer, flush on leave; `fetchReviewQueue`, `decideReport`, `reportedTimes`, `reasonLabel`, "Hidden by reports" when `hidden_at`), `ManageEventsScreen` (`fetchAllEvents`, `saveEvent`, `deleteEvent`, `eventProblem`, `parseEventWhen`, `eventInputFromIso`, optional community), `ManagePerksScreen` (`fetchAllBrands`, `fetchAllPerks`, `createBrand`, `createPerk`, `setPerkActive`, `brandProblem`, `perkProblem`; mark the old sample ones "Hidden from students").
5. Try every screen on the web at 390 and 1440, light and dark (port 8084), then the full checks (`npx expo-doctor`, `npx expo export --platform web` not run yet), Codex review, record findings here, push, PR.

**Open points for the report**: an area tag opens the Housing tab without the area (no Housing `area` param yet); Undo after a review decision is sent needs a "reopen reports" database function; `useConfirmDiscard` is not used on New post because its `Alert.alert` does nothing on the web.

**Update, same session (continued):** items 1 to 5 above are done: main merged, Messages opens `navigate('Inbox')`, all seven remaining screens built, checks run, Codex review below.

## Changes from the plan
- Chief Architect decision (2026-11-25): tapping an area tag opens the Housing tab, without the area, for now.
- Owner request (2026-11-25): a Messages button with an unread dot next to Post on the Community tab (the app now has three tabs).
- The Events shortcut on the Community tab switches the list to upcoming events (there is no separate events route).
- The demo (guest mode) still shows its own made-up sample perks; the old real-database sample perks and Veldemers stay hidden from students.
- New post does not ask "Discard changes?" on leaving: the shared `useConfirmDiscard` uses `Alert.alert`, which does nothing on the web and would trap the screen.
- Extra shared files in `src/components/community/`: `CommunityPicker.tsx`, `FindCommunities.tsx`, `TagPicker.tsx`, `useMembership.tsx`, `useHousemateActions.tsx`, `usePostActions.tsx`, `SafetyMenu.tsx`.

## Verification
- `npm run typecheck`: pass. `npm run lint`: pass. `npm test`: 18 files, 177 tests pass (25 new in `community.test.ts`).
- `npx expo-doctor`: 20/20 checks passed. `npx expo export --platform web`: exported.
- Browser check on port 8084 in the demo (guest mode, sample data only, no real database): Community tab at 375 wide (dark) and 1440 wide (light), no sideways scroll (scrollWidth 1440 = window 1440); a community's Posts, Housemates (Nora's sample card with "Message Nora"), Events and Perks sections; the Events view and an event page. Fixed what it found: "Join" was unreadable on the berry header in dark mode; the Events view always showed "No events coming up"; the demo's sample perks were hidden.
- Not checked in the browser: anything that writes (posting with photos, likes, comments, reports, Going, Get code, joining, team screens), because the demo blocks writes and this lane may not create accounts. The Chief Architect's real-accounts check covers these.
- Console: only warnings from the Housing screen (nested buttons), not from Community.

## Codex review

**Round 1: VERDICT: FINDINGS(3)**
1. MAJOR, `communityPhotos.ts`: a signed link already given out keeps working until it expires (1 hour), even after the post is hidden. **Dismissed**: the brief sets `createSignedUrl(path, 3600)`; the store cannot take back a link once given, but new links stop at once and cached ones are dropped. A shorter time is for the Chief Architect to decide.
2. MAJOR, `PerkCard.tsx`: perk codes were not tied to the account, so a screen that stays open across an account change could show the previous account's code for a moment. **Fixed**: codes and Going are now tagged with the account that loaded them.
3. MAJOR, `PostCard.tsx`: an area tag opens Housing without the area. **Dismissed**: the Chief Architect decided this is fine for now (no Housing area parameter yet).

**Round 2: VERDICT: FINDINGS(4)**
1. MAJOR, `communityApi.ts`: "Get code" could claim an inactive or expired perk by its id. **Dismissed**: `claim_offer` checks `is_active`, `starts_at` and `ends_at` in the database (`20261125200000_community_v2.sql`).
2. MAJOR, `communityApi.ts`: if loading my codes fails, "Get code" shows again. **Dismissed**: tapping it calls `claim_offer`, which returns the same code, so nothing wrong happens.
3. MAJOR, `EventCard.tsx`: events could show without Going for a moment after an account change. **Dismissed**: signing out replaces the whole navigation stack, and the Community screens are keyed by account; Going is now tied to the account as well (round 1 fix).
4. MINOR, `community.ts`: a time like `9:30` is accepted though the label says HH:MM. **Dismissed**: it is read correctly as 09:30; being lenient helps the team.

Stopped after round 2: only dismissed findings remain.
