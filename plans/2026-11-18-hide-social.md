# Plan: hide the social features behind a switch

Branch: `feature/hide-social`. Written by the Chief Architect (navigation and shared files).

## Goal
A signed-in student sees a housing app: four tabs (Housing, Saved, Inbox, Profile), with no feed, Discover, posts, communities, events, follow lists or perks anywhere. One switch brings the social side back. No code is deleted and the database is untouched.

## Feature
Follows F4 (Housing first). Not a new feature ID: it narrows the app to the housing pivot. Done check: I log in and the tab bar shows only Housing, Saved, Inbox and Profile, and I cannot reach any social screen by tapping.

## Steps
1. **The switch.** New `src/lib/features.ts` exporting `SOCIAL_ENABLED = false`. Run: typecheck.
2. **Tabs.** In `RootNavigator.tsx` and `TabBar.tsx`, register Feed and Discover only when the switch is on; add a Saved tab (reusing the saved-places list that Compare already loads, see Questions); drop the floating "+" (new post) button when off. Run: web app shows four tabs.
3. **Social screens out of the stack.** With the switch off, do not register PostDetail, UserProfile, SharePost, NewGroup, Communities, CommunityDetail, CreatePost, CreateEvent, FollowList, Offers, OfferDetail, EventDetail, ManageBrands, CreateOffer. Keep Notifications, Chat, Settings, EditProfile, BlockedUsers, Map and all housing screens.
4. **Entry points.** Hide the taps that lead to the social screens: on Profile the Posts/Saved-posts grid, follower and following counts, and perks rows; on Inbox the new-group button and shared-post cards; on Settings "Create event"; in Chat the tap on a person (opens UserProfile) and shared posts; in Notifications, notifications about posts, follows and offers are filtered out; on the Map, event and offer pins and their popups.
5. **Onboarding and demo.** Onboarding keeps only what housing needs (no interest chips for communities if they lead nowhere); the demo-mode banner and sample content keep working with four tabs.
6. **Checks.** typecheck, lint, tests, expo-doctor, `expo export`; walk the app in light and dark; flipping the switch to true brings back all five original tabs.

## Files
- Create: `src/lib/features.ts`.
- Change: `src/navigation/RootNavigator.tsx`, `src/navigation/TabBar.tsx`, `src/screens/ProfileScreen.tsx`, `InboxScreen.tsx`, `ChatScreen.tsx`, `SettingsScreen.tsx`, `NotificationsScreen.tsx`, `MapScreen.tsx`, `OnboardingScreen.tsx`, `CLAUDE.md` (one line on the switch).
- Not touched: `supabase/`, `src/guest/` data, any social screen file itself.

## Checks
1. `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`, `npx expo export --platform web` pass.
2. Signed in (demo mode counts): tab bar is Housing, Saved, Inbox, Profile; Housing opens first.
3. Tap through Profile, Inbox, Chat, Settings, Notifications and Map: nothing opens a feed, post, community, event, perk or another person's social profile; no dead taps or blank screens.
4. Housing, listing, split, compare, enquiry and the admin screens behave as before.
5. Set `SOCIAL_ENABLED = true` locally: the original five tabs and every social screen work again.
6. Saved tab lists saved places, and shows an empty state when there are none.

## What could break
Hiding screens that other screens still link to: a tap that navigates to an unregistered screen does nothing or errors on native. Step 4 and check 3 exist for this. Also Inbox: chat messages that carry a shared post must not crash when the post screen is missing.

## Not doing
- Deleting any social code, tables, or policies (a later pull request, after a few weeks of nothing missed).
- New features, a new look for Profile, or a redesign of Inbox as an enquiry thread (separate plan).
- Removing the Map (kept; its native-only limit stays).
- Changing the signed-out flow.

## Questions
1. **Saved tab:** reuse the saved-places list on the Compare screen as the Saved tab (smallest change, my recommendation), or build a separate Saved screen?
2. **Notifications bell:** keep it (filtered to housing: enquiry updates) or hide it for now? I suggest hide it, since the only live notifications are social.
