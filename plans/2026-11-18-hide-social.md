# Plan: remove the social features, archive them for later

Branch: `feature/hide-social` (name kept from the first draft). Written by the Chief Architect. Updated after the owner's answers: the Saved tab reuses the Compare list; the bell stays for enquiry updates; the features that need a crowd are removed for real and kept safe in an archive.

## Goal
A signed-in student sees a housing app: four tabs (Housing, Saved, Inbox, Profile) and no trace of the feed, posts, communities, events or follow lists. The removed code is not lost: it is frozen in a git tag so it can be brought back when there are enough students. The database is untouched.

## Feature
Follows F4 (Housing first). Not a new feature ID. Done check: I log in and see exactly four tabs, no tap anywhere opens a social screen, and enquiry updates still arrive in the bell.

## What goes, what stays
| | Decision | Why |
|---|---|---|
| Feed, posts, video, post detail, create post, share post | **Removed** (archived) | Needs a crowd |
| Discover tab | **Removed** | It only points at the social features |
| Communities, community detail, group chat (new group) | **Removed** | Needs a crowd |
| Events, event detail, create event, check-ins | **Removed** | Needs a crowd |
| Follow lists, other people's profiles | **Removed** | Only matter with a feed |
| Perks and offers (Offers, OfferDetail, ManageBrands, CreateOffer) | **Kept in the code, unlinked** | Student discounts are part of the pitch; they come back when brands sign up |
| Notifications bell | **Kept**, shows enquiry updates only | The enquiry notifications already exist in the database |
| Inbox and one-to-one chat | **Kept** | Becomes the enquiry thread later |
| Map | **Kept** | Shows places to live |
| Profile | **Kept**, cut down to saved places, enquiries and settings | |

## Steps
1. **Archive first.** Tag the current main as `archive/social-v1` and push the tag, and write `docs/archive/social.md`: what was removed, the tag name, and how to restore it (`git checkout archive/social-v1 -- <path>`). Run: `git tag` shows it and it is on GitHub.
2. **Tabs.** `RootNavigator.tsx` and `TabBar.tsx`: tabs become Housing, Saved, Inbox, Profile; remove the floating "+"; the Saved tab shows the saved-places list from the Compare screen (retitled "Saved", empty state when nothing is saved). Run: web app shows four tabs.
3. **Remove the screens** listed as removed, plus files only they use (found with a search at build time, for example the video player and post cards) and their routes and types in the navigator. Run: typecheck shows what still points at them.
4. **Clean the entry points** that led to them: Profile (posts grid, follower counts, perks rows), Inbox (new-group button, shared-post cards), Chat (tap on a person, shared posts), Settings ("Create event"), Map (event pins and popups; offer pins removed too, since perks are unlinked), Onboarding (interest steps that lead nowhere). Run: typecheck, then tap through each screen.
5. **Bell.** `NotificationsScreen.tsx` lists only `enquiry_new` and `enquiry_status` and opens the enquiry; follow, like, comment and offer notifications are not shown. Run: demo and a signed-in check.
6. **Demo mode and tests.** Remove the social sample content from `src/guest/` only where a removed screen needed it, and keep the guest tests passing (never weakened; a test of a removed feature is removed with it and said so here). Run: `npm test`.
7. **Dead-link test.** A permanent test reads every `navigate('Name')` and `getParent()?.navigate('Name')` in `src/` and fails if `Name` is not a registered screen. Run: `npm test`.
8. **Old data.** Notifications query asks only for `enquiry_new` and `enquiry_status`; a chat message that shared a post renders as plain text "Shared a post (no longer available)" and never opens it. Tests feed in old-style rows and check nothing crashes.
9. **Checks.** typecheck, lint, tests, expo-doctor, `expo export`; walk the app in light and dark, scripted tap-through of every tab and screen with the console watched for errors.

## Files
- Create: `docs/archive/social.md`, the git tag `archive/social-v1`.
- Change: `src/navigation/RootNavigator.tsx`, `TabBar.tsx`, `src/screens/ProfileScreen.tsx`, `InboxScreen.tsx`, `ChatScreen.tsx`, `SettingsScreen.tsx`, `NotificationsScreen.tsx`, `MapScreen.tsx`, `OnboardingScreen.tsx`, `CompareScreen.tsx` (title only), `src/types/index.ts`, `src/guest/`, `CLAUDE.md`.
- Delete: about 12 screen files (roughly 5,000 lines) and the components only they use.
- Not touched: `supabase/` (tables, policies and functions all stay).

## Checks
1. `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`, `npx expo export --platform web` pass.
2. `git tag` lists `archive/social-v1` and `git ls-remote --tags origin` shows it.
3. Signed in (demo counts): tab bar is Housing, Saved, Inbox, Profile; Housing opens first.
4. Tap through Profile, Inbox, Chat, Settings, Notifications, Map: no dead taps, no blank screens, nothing about posts, communities, events or followers.
5. Saved tab: three saved places show; with none, an empty state; Compare still works from Housing.
6. In a real account, a new enquiry status produces a bell item that opens the enquiry (tested with a test account on the live database, then removed).
7. Housing, listing, split, enquiry and admin screens behave as before.

## What could break
Removed code that something kept still imports: typecheck catches it. Chat messages that carried a shared post, and old notifications about posts, must be skipped without crashing (check 4). Restoring later will need the navigator and types edited back by hand, which the archive note explains.

## Not doing
- Dropping database tables, policies or functions (later, separate plan, after weeks of nothing missed).
- Turning Inbox into an enquiry thread, a new Profile, or new notification types.
- Removing the perks code or the Map.

## Questions
None open.
