# Plan: trust signals and a renting guide

Branch: `feature/trust-and-guide`. The first of the cheap items from the owner's list (after Housemates): make Verified mean something a student can see, and help a first-time renter in Dubai.

## Goal
A student can see when a listing was checked and what "Verified" means, is told clearly when a listing has not been checked, and can read a plain guide to renting in Dubai (costs, papers, sharing, getting a deposit back, questions to ask) without making an account.

## Steps
1. **Trust on the listing page.** Next to the Verified badge: "Checked on 12 November 2026" (the date already stored when the team marks a listing verified; no database change). Tapping the badge opens a short sheet, "What does Verified mean?". A listing that is not verified shows "Not checked by Havenly yet. Before you pay, ask for the permit number and a written contract." with a link to the guide. The permit number line gets its proper name: "Advert permit (Trakheesi) no.".
2. **The guide.** A new screen, "Renting in Dubai", with six sections written from the published sources I read (listed at the bottom of the screen with links) and dated "last checked 23 November 2026": before you pay anything; what it costs to move in (deposit, Ejari, DEWA, agent fee, what is included); papers you may be asked for; sharing a home (Dubai's 2026 shared-housing law); getting your deposit back; questions to ask a provider. Where the sources do not say, the guide says "ask your provider" rather than guessing. A short line at the top: general guidance, not legal advice, prices and rules change.
3. **Entry points.** A "New to renting in Dubai? Read the guide" row on the Housing screen and a "Before you pay" link at the bottom of every listing page. The screen opens for signed-out visitors too.
4. **Tests.** The guide content is checked by a test (every section has a title and points, every source is a secure link, the date is present) so it cannot ship half-written; the dead-link test gets the new route.
5. Checks, browser walk-through, Codex, PR.

## Files
Create `src/constants/rentingGuide.ts`, `src/constants/rentingGuide.test.ts`, `src/screens/GuideScreen.tsx`. Change `src/screens/ResidenceDetailScreen.tsx`, `HousingScreen.tsx`, `src/navigation/RootNavigator.tsx`, `routes.test.ts`.

## Checks
1. typecheck, lint, tests, expo-doctor, export pass.
2. Browser (demo and signed out): the guide opens from Housing and from a listing; a verified sample listing shows its checked date and the Verified sheet; an unverified one shows the "not checked yet" line; the sources open as links.
3. Every figure in the guide traces to a listed source or is phrased as "ask".

## What could break
The words in the guide and in "What does Verified mean?" are promises. The guide must not state a rule the sources do not support (it is general guidance, dated, with sources, and flagged for the founder and a lawyer to read). **The Verified sheet states what the Havenly team actually checks, which only the founder can confirm**, so its wording is a draft until the owner approves it.

## Not doing
Translating the guide, a calculator, a permit-number lookup against the Dubai Land Department, changing what "Verified" requires in the admin form, trust data on result cards.

## Questions
1. What does the Havenly team really check before marking a listing Verified? My draft says: that the provider is real, the advert permit number is valid, and the price and details match what the provider told us. Please correct it to what you actually do.
