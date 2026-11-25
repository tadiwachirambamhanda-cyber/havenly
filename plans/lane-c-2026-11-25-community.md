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

## Changes from the plan

## Verification

## Codex review
