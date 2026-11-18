# Archived: the social features

Removed from the app on 2026-11-18 when Havenly became a housing-first platform. The code is frozen at git tag **`archive/social-v1`** (on GitHub). Nothing in the database was dropped: tables, policies and functions for posts, communities, events, follows, check-ins and offers all still exist.

## What was removed
Feed, posts and video, post detail, create post, share post, Discover, communities (list and detail), group chat creation, events (detail and create), check-ins, follow lists, other people's profiles, the floating "+" button, the post grid on Profile, and the interest picker in onboarding. Also the files only they used (`VideoThumb`, `PostVideoPlayer`, `uploadWithProgress`, `constants/tags`, `utils/formatCount`).

## What stayed, changed
- Tabs are now Housing, Saved, Inbox, Profile.
- Notifications shows only enquiry updates (`enquiry_new`, `enquiry_status`); it opens from Profile, with a dot on the Profile tab when there is something new.
- A chat message that shared a post reads "Shared a post (no longer available)".
- The Map shows homes only. Perks code (`OffersScreen`, `OfferDetailScreen`, `ManageBrandsScreen`, `CreateOfferScreen`) is still in the repo but nothing links to it.
- The sample content for these features is still in `src/guest/fixtures.ts`, unused.

## How to bring something back
1. Look at what the tag had: `git show archive/social-v1:src/screens/FeedScreen.tsx`.
2. Restore the file: `git checkout archive/social-v1 -- src/screens/FeedScreen.tsx` (and the components it needs, see `git diff --stat archive/social-v1 main`).
3. Register the screen and its route type in `src/navigation/RootNavigator.tsx`, add the tab to `TabBar.tsx` if it is a tab, and link to it from where it belongs.
4. Run the checks. `src/navigation/routes.test.ts` lists the screens that must stay absent: take the restored ones out of its "gone" list.
