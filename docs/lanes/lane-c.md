# Lane brief: Lane C

Written by the Chief Architect on 2026-11-25. Merged to main with the v2 foundation before the lane starts.

| Field | Value |
|---|---|
| Lane name | `Lane C` |
| Goal | A signed-in student can join university communities, post questions with photos and area tags, like, comment and report, find housemates, events and perks in Community; the team can review reports and add events and perks. |
| Features | F18, F19, F20 (posting with a tag; the listing-page section is Lane A's), F21, F22, F23, F24 |
| Worktree and branch | `.claude/worktrees/lane-c`, branch `worktree-lane-c` |
| Starting point | main after the v2 foundation pull request is merged (the Chief Architect posts the commit) |
| Allowed files and folders | The placeholder screens to build: `src/screens/CommunityScreen.tsx`, `CommunityDetailScreen.tsx`, `CreatePostScreen.tsx`, `PostDetailScreen.tsx`, `EventDetailScreen.tsx`, `PerksScreen.tsx`, `PerkDetailScreen.tsx`, `ReviewQueueScreen.tsx`, `ManageEventsScreen.tsx`, `ManagePerksScreen.tsx`; the housemate screens `HousemateBoardScreen.tsx`, `MyHousemateCardScreen.tsx`, `HousemateReviewScreen.tsx`; `src/screens/ProfileScreen.tsx` (only to remove its Housemates block, F21); new `src/components/community/`; new `src/lib/community*.ts` and their tests; `src/lib/housemates.ts`, `src/lib/housematesApi.ts` and their tests; `plans/lane-c-*` |
| Do not touch | Everything else, above all: `src/theme/`, `src/types/`, `src/navigation/`, `src/constants/`, `src/guest/`, `supabase/`, `package.json`, `App.tsx`, `docs/`, `design/`, `CLAUDE.md`, `src/screens/ComingSoonScreen.tsx`, and Lane A's housing screens and `src/components/housing/`. |
| Builds on | Design: `design/handoff/README.md` and `Community.dc.html`, `CommunityDetail.dc.html`, `CreatePost.dc.html`, `ReviewQueue.dc.html` (live canvas linked in the README). Data (live already, migration `20261125200000_community_v2.sql`): `communities`, `community_members` (join any, 20 at most), `posts` (`body`, `image_paths` up to 4 inside your own folder of the `post-images` store, `area`, `residence_id`, `hidden_at`), `comments`, `post_likes` with `toggle_post_like`, `report_item(type, id, reason)`, `review_queue()` and `decide_report(type, id, 'hide'\|'keep')` for the team, `events` (`community_id`, `going_count`) and `event_going`, `offers`, `brands`, `offer_claims` with `claim_offer(offer_id)` (same code every time). Reading a post's author: posts link to profiles in two ways (the author, and likes), so name the link: `author:profiles!posts_author_id_fkey(display_name, avatar_url, university)`. Types: `Post`, `Comment`, `Community`, `HavenlyEvent`, `Offer`, `ReportReason`, `ReviewItem` in `src/types/index.ts`. Area names: `AREAS` in `src/constants/areas.ts`. Tokens: `mintBg`, `mintText`, `mintFill`, `mintOn`, `dealBg`, `dealText`, `photo`, `coralFill` and the rest in `src/theme/tokens.ts`. Routes and their params are already registered in `src/navigation/RootNavigator.tsx`. |
| Dev server port | 8084 (`npx expo start --web --port 8084`) |
| Depends on / blocks | Depends on the foundation. Lane A shows tagged posts on the listing page through `area_posts` and opens `PostDetail` when one is tapped: keep `PostDetail` taking `{ postId }`. Keep `HousemateBoard` and `MyHousemateCard` working with their `{ residenceId }` param, because the listing page opens them. |

## Done means

- [ ] **F18:** signed in as a student at university A, I open Community and see A first (berry card), join B from "Find more", and B's posts appear under "Latest from your communities". I leave B and it moves out of "My communities". A 21st community is refused with a clear message.
- [ ] **F19:** in B, "Write a post" opens the sheet; Post is disabled until I type; I post "Anyone near DIAC?" with 2 photos. Another student likes it (mint) and comments; I see both. I delete my post and it is gone for both of us. Every post shows the poster's name, photo and university.
- [ ] **F20 (posting):** I tag my post "Jumeirah Lake Towers" (from `AREAS`) or pick a listing; the tag chip shows on the post and tapping it opens the listing or the Housing search for that area.
- [ ] **F21:** in my university's community, Housemates shows only cards whose preferences match mine (same rules as today), with "Message" and "My housemate card". Profile no longer has a Housemates block.
- [ ] **F22:** Events shows upcoming events (past ones gone); "I'm going" turns mint with a tick and the count goes up by 1; tapping again takes it back. As the team, Manage events adds, edits and deletes an event, optionally for one community.
- [ ] **F23:** Perks lists active perks in the sun colour; "Get code" shows my personal code; tapping again shows the same code. As the team, Manage perks adds a brand and a perk and can switch a perk off.
- [ ] **F24:** the ⋯ menu on a post, comment and event has "Report" (choose a reason) and "Block <name>" where there is a person. As the team, Review reports lists each reported item with its reasons and count, marks "Hidden by reports" at 3, and Hide or Keep (with Undo) works; "Nothing to review" when empty. Reporters are never shown.
- [ ] Old sample perks: before showing perks, ask the Chief Architect; the 4 old "Sample" perks and the "Veldemers" brand stay hidden until the owner decides.
- [ ] Every screen has empty, loading and error states (handoff README, "States to build"), works at 390 and 1440 wide in light and dark, and has no sideways scroll.

## Checks to run before reporting

`npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`, `npx expo export --platform web`, then a real-accounts check of joining, posting, reporting and the team queue (ask the Chief Architect for a temporary admin and clean up afterwards), then /codex-review with every finding triaged, then /pr.

## How to report

Send a message to "Chief Architect" in this format:

```text
STATUS: DONE | BLOCKED | QUESTION
PR: #<number>
Checks: green | red (what failed)
Files changed outside my allowed list: none
Look at: <one line on what to check first>
```

## When to stop and ask instead of guessing

- You need to change a file on the "Do not touch" list (a new column, function, route, type or token).
- The brief and the handoff disagree.
- The same error happens 3 times.
- You are about to build something not in "Done means" (no follows, global feed, video or notifications for likes and comments in this version).
