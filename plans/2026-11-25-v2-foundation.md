# Plan: v2 foundation (new look, Community tab, removals, community database)

## Goal
After this, every screen wears the approved v2 colours, the app has a Community tab, Map and Compare are gone, and the database is ready for Lane A (housing) and Lane C (community) to build on without touching shared files.

## Feature
F14 (shared part: tokens, logo colour, Community tab), F17 (remove Map and Compare), and the data behind F18 to F24. Done checks from `docs/feature-list.md`: the app opens on Housing with a Community tab second and the new colours on every screen in light and dark; no Map or Compare button anywhere. The community screens themselves are Lane C's; this PR gives them placeholders.

## Steps
1. **Tokens and logo.** Set the v2 values in `src/theme/tokens.ts` from `design/handoff/README.md` (same names, new values) and add the new ones: `mintBg`, `mintText`, `mintFill`, `mintOn`, `photo`, `verifiedBg`, `verifiedText`, `tabBg`, `tabInk`. Logo mark and full stop take `coral` (berry). Check the dark values on the tab bar.
2. **Community tab and routes.** Tabs: Housing, Community, Saved, Inbox, Profile (Housing stays the first screen). Register placeholder screens for Lane C: `Community` (tab), `CommunityDetail`, `CreatePost`, `PostDetail`, `EventDetail`, `Perks`, `PerkDetail`, `ReviewQueue`, `ManageEvents`, `ManagePerks`, each a titled "Coming soon" screen. Route types and `routes.test.ts` updated. The old perks screens (`OffersScreen`, `OfferDetailScreen`, `CreateOfferScreen`, `ManageBrandsScreen`) are still registered as routes; they are deleted in this PR (Lane C builds perks fresh from the design), so nobody edits them twice. Signed out, the Community tab shows the sign-in prompt with why; in demo mode it shows the placeholder (all writes stay blocked).
3. **Remove Map and Compare (F17).** Delete `MapScreen`, `CompareScreen`, `compareStore` and every button that opens them (Housing, listing page, Saved), their routes, and demo data only they used. "Open in Maps" on the listing stays. Add both to the "gone" list in `routes.test.ts`.
4. **Database (one migration, tried in a rolled-back test first).**
   - Joining: anyone signed in can join any community (the old rule allowed only your own university's campus community), up to 20 at once.
   - Reading: posts, comments, likes, memberships and events need a signed-in account (today anyone can read posts); blocked people stay hidden from each other.
   - Posts: only inside a community you have joined, enforced on new posts (the 4 old posts without a community stay as they are, no column change that would fail on them); up to 4 photos (`image_urls`, each inside the author's own folder of the photo store); optional area tag (`area`) or listing tag (`residence_id`, cleared if the listing is deleted); a function lists the posts for a listing page: tagged with that listing or its area, newest first, not hidden.
   - Reports: on a post, comment or event that exists, never your own; one per student per item; sent through one function (no direct writes); reasons from a fixed list; when 3 different students report the same item it is hidden (`hidden_at`) until the team decides. Only accounts older than one day count towards the 3, so fresh throwaway accounts cannot hide a post; one person with three older accounts still could, and that risk is accepted for now (the team can Keep it). A hidden event disappears for students, with its Going list. Hidden items are seen only by the team and their author. Students can read only their own reports. Known limit: photos sit in the public photo store, so a hidden post's photos still open by their (unguessable) direct link; moving them to a private store is in Ideas for later. The team (admin only) gets a queue function and a decide function (hide or keep; keep clears the hidden mark and closes its reports); reporters are never shown to the person reported.
   - Events: team only (as today), optionally tied to one community; students mark Going (one row each, a count).
   - Perks: "Get code" (the existing `claim_offer` function, same name and return shape) gives one personal code per student per perk, the same code each time; the old streak requirement is dropped.
   - Old content: the 4 old posts have no community, so they no longer show anywhere; nothing is deleted (see Questions).
5. **Shared types and helpers.** Types for Community, Post, Comment, Event, Perk, Report in `src/types/index.ts`; the list of areas students can tag (`src/constants/areas.ts`, the same area names listings use).
6. **Lane setup.** Rewrite `docs/lanes/lane-a.md` for v2, write `docs/lanes/lane-c.md`, update the ownership table in `CLAUDE.md` (Lane C owns the community screens, `src/components/community/`, `src/lib/community*.ts`, the housemate screens, Profile's Housemates block), `.worktreeinclude`, and `.gitignore` (`.claude/worktrees/`, `.review/`).
7. **Prove it.** Checks below, then the pull request with the brief, designs and this foundation together.

## Files
Change: `src/theme/tokens.ts`, `src/components/Brand.tsx`, `src/components/TabBar.tsx`, `src/navigation/RootNavigator.tsx`, `src/navigation/routes.test.ts`, `src/types/index.ts`, `src/screens/HousingScreen.tsx`, `ResidenceDetailScreen.tsx`, `SavedScreen.tsx` (remove Map and Compare buttons only), `src/guest/` (drop data only Map and Compare used), `supabase/schema.sql`, `CLAUDE.md`, `.gitignore`, `docs/lanes/lane-a.md`. Create: `supabase/migrations/<timestamp>_community_v2.sql`, `scripts/db-tests/community.py`, `src/screens/ComingSoonScreen.tsx` (one placeholder used by every new route), `src/constants/areas.ts`, `docs/lanes/lane-c.md`, `.worktreeinclude`. Delete: `MapScreen.tsx`, `CompareScreen.tsx`, `src/components/housing/compareStore.ts`, `OffersScreen.tsx`, `OfferDetailScreen.tsx`, `CreateOfferScreen.tsx`, `ManageBrandsScreen.tsx`. Lane A's files (`HousingScreen`, `ResidenceDetailScreen`, `SavedScreen`, `CompareScreen`) are changed here only because Lane A has not started; it starts from main after this PR is merged.

## Checks
1. `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`, `npx expo export --platform all` pass.
2. App at 390 and 1440 wide, light and dark: opens on Housing; five tabs with Community second, all five labels readable at 390; signed out, Community shows the sign-in prompt; in demo mode it shows the placeholder; berry, mint and sun appear as in the handoff; no Map or Compare button anywhere; the Community tab and every new route open their placeholder.
3. Database, rolled back: a student joins a community of another university; a signed-out visitor reads no posts, comments or memberships; a non-member cannot post in a community; a member posts with 4 photos (a 5th is refused) and an area tag; the listing function returns posts tagged with the listing or its area and not hidden ones; 3 reports from different students hide a post, 2 do not, the same student cannot report twice, a student cannot report their own post or a post that does not exist, reports from accounts younger than a day do not count; a hidden event disappears for students; a photo path outside the author's folder is refused; 21 communities cannot be joined at once; the 4 old posts are untouched (the test runs on the live data and rolls back); the author and the team still see it, others do not; a student cannot see who reported, cannot call the team's queue or decide functions; Keep unhides it; Going toggles and counts; Get code returns the same code twice; housing, enquiries, alerts and saved places still work. `src/guest/guest.test.ts` still passes.
4. Live, after the migration is applied: the app's Housing, listing, enquiry and Saved screens still load for a signed-out visitor and a signed-in student; a chat message that shared an old post reads "Shared a post (no longer available)" instead of breaking.

## What could break
Step 3 touches three housing screens that Lane A will then rebuild: only the Map and Compare buttons are removed. Step 4 changes who can read posts and join communities on the live database. The only screen today that reads posts is Chat (a message that shared a post); old shared posts will read "Shared a post (no longer available)", which the app already shows for posts it cannot load. Housing tables are not touched.

## Not doing
The community screens themselves (Lane C), the housing restyle, filters and inline split (Lane A), removing demo mode (after real listings), notifications for likes and comments, new app icon or splash images in berry (needs new image files; see Ideas for later), deleting old sample content without the owner's yes.

## Questions
1. May I apply the database migration to the live database after the rolled-back test passes?
2. The live database still has old sample content: 4 old posts (outside any community, so they will no longer show), 5 brands and 4 perks (four of them named "Sample …", one called "Veldemers"). Keep them hidden and untouched for now, or delete them? (Recommended: keep for now, decide when real perks arrive.)

## Plan check
Fresh review, 6 findings, all accepted:
1. Chat reads posts: covered in step 4's wording, What could break and check 4. 2. Old perk screens would call a changed function: deleted in this PR, `claim_offer` keeps its name and shape. 3. Hidden posts' photos stay public by link: written down as a known limit with a check that photos are in the author's folder; private store in Ideas for later. 4. Report abuse and gaps: self-reports, missing items and fresh accounts excluded, multi-account risk accepted and stated, hidden events covered, tests added. 5. Guest and ownership: demo shows the placeholder, guest tests in check 3, Lane A starts after this merges. 6. Old posts and join limit: rule on new posts only, test runs on live data, 20-community limit. Smaller note: five labels at 390 and the signed-out Community tab added to check 2.

## Ideas for later
- Move post photos to a private store so hidden posts' photos stop opening by link.
- New app icon and splash images in berry (the icon is still oxblood).

## Answers (owner, 2026-11-25)
"yes, keep, build": 1 apply the migration after the rolled-back test; 2 keep the old sample posts, brands and perks hidden and untouched for now.

## Changes from the plan
- Signed-out visitors have no tab bar (they see the public Housing screen only), so the Community tab cannot be reached signed out and needs no sign-in prompt there.
- Post photos are stored as paths inside the photo store (`image_paths`), not full links, so the "author's own folder" rule can be checked exactly; the app builds the link.
- Posts used to need a title and a tag. v2 posts have neither, so the title is now optional, the tag defaults to "community", and post text must be 1 to 2,000 characters (old posts untouched).
- The deleted Map, Compare and old perk screens went into the colours commit instead of the removals commit (same branch, no effect on the result).
- The rolled-back test is kept as `scripts/db-tests/community.py`.

## Verification (2026-11-25)
1. typecheck 0 errors, lint clean, 149 tests passing (including `guest.test.ts` and the routes test with the new and removed screens), expo-doctor 20/20, export for web, iOS and Android succeeded.
2. App, demo mode at 390 wide: opens on Housing in the new berry look (logo full stop, active tab, primary buttons); five tabs with all labels readable; Community opens its placeholder; dark mode shows the light tab pill with the berry active tab and the mint placeholder. No Map or Compare button remains (also guarded by the routes test). 1440 wide was not checked separately this round (layouts did not change; Lane A restyles).
3. Database, rolled back on the live data: 43/43 checks passed (joining any community and the 20 limit; signed out reads nothing; non-members cannot post; 4 photos yes, 5 or another folder no; no posting as someone else; listing posts by area; reports: not your own, not missing, fixed reasons, one each, direct post reports refused while user reports still work, fresh accounts do not count, 3 hide it; hidden posts gone for others, likes and comments refused, still seen by author and team; reporters private; queue and decide team-only; Keep restores and closes reports; Going counts and toggles; hidden event gone and cannot be joined; comments hidden at 3; perk code without streak and the same twice; old posts untouched; saving a place and signed-out listings still work).
4. Live, after applying: signed-out Housing loads; a temporary student account read listings, Saved, enquiries, alert settings and the bell, saw 52 communities, joined one, posted with an area tag, called `area_posts`, and was refused the team queue (12/13; the 13th was the test's own query, which must name the author link `posts_author_id_fkey`, now noted in Lane C's brief). The account and its post were deleted: 7 profiles, 4 posts, 1 membership, as before. The Chat shared-post case is covered by the existing `chatMessage` test ("Shared a post (no longer available)").

## Codex review
Round 1: VERDICT FINDINGS(4), all MAJOR, all fixed in `supabase/migrations/20261125210000_community_v2_fixes.sql` (rolled-back test `scripts/db-tests/community_fixes.py`, 10/10, then applied live):
1. Any signed-in student could read everyone's community memberships. **Fixed:** students see only their own; the team sees all; counts come from `member_count`.
2. Comments of a hidden post could still be read directly. **Fixed:** a comment is visible only while its post is.
3. Two joins at the same moment could pass the 20 limit. **Fixed:** a trigger makes one student's joins wait for each other, then counts.
4. Reports from fresh accounts could start counting once the accounts aged. **Fixed:** a report counts only if the account was a day old when it was made.
