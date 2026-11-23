# Plan: trust signals and a renting guide

Branch: `feature/trust-and-guide`. The first of the cheap items from the owner's list (after Housemates): make Verified mean something a student can see, and help a first-time renter in Dubai.

## Goal
A student can see when a listing was checked and what "Verified" means, is told clearly when a listing has not been checked, and can read a plain guide to renting in Dubai (costs, papers, sharing, getting a deposit back, questions to ask) without making an account.

## Steps
1. **Trust on the listing page.** Next to the Verified badge: "Verified on 12 November 2026" (the date already stored when the team marks a listing verified; no database change). Tapping the badge opens a short sheet, "What does Verified mean?". A listing that is not verified shows "Not checked by Havenly yet. Before you pay, ask for the permit number and a written contract." with a link to the guide. The permit number line gets its proper name: "Advert permit (Trakheesi) no.".
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

## Changes from the plan
- Added `src/lib/trust.ts` (`formatCheckedDate`, dated in Dubai time, UTC+4) with tests.
- The Verified explainer is an ActionSheet with "Read the renting guide" and "Got it". Its text, and the "not checked" line, live with the guide content in `src/constants/rentingGuide.ts`.

## Verification
1. typecheck, lint (no warnings), 123 tests (8 new: guide content integrity, checked-date formatting), expo-doctor and export (run below) pass.
2. Browser: signed out, the Housing screen shows "New to renting in Dubai? Read the guide" and the guide opens with the dated disclaimer, six sections and the sources. In the demo: a verified listing shows the badge, "Checked on 13 November 2026" and "What does Verified mean?", which opens the explainer sheet; an unverified listing shows "Not checked by Havenly yet. Before you pay, ask for the permit number and a written contract. Read the renting guide"; every listing ends with "Before you pay: read the renting guide".
3. Not checked: the guide's facts against a source other than the published pages I read (research was cut short by a search limit, so anything beyond them is phrased as "ask"); a phone.

## Codex review
Round 1: VERDICT FINDINGS(5).
1. MAJOR, `rentingGuide.ts:24`: "never in cash to a person" was an absolute rule the sources do not give. **Fixed:** follow the payment instructions in the written contract, check them with the provider, keep receipts, and be wary of requests for cash or a personal account.
2. MAJOR, `rentingGuide.ts:31`: the cost list left out Dubai's housing fee on the DEWA bill. **Fixed:** added, as "about 5% of the annual rent" per the sources, with "ask what it will be".
3. MAJOR, `rentingGuide.ts:99`: the Verified explainer states checks the code cannot prove the team performs. **Kept open on purpose:** the wording is a draft and the owner must confirm it matches what the team really does before this merges (it is the question in this plan and in the PR). It is deliberately written as the full claim so the owner corrects it to the truth, not as a vague text that hides the question.
4. MAJOR, `ResidenceDetailScreen.tsx:247`: "Checked on" used `verified_at`, which keeps the first verification date, so it could imply a more recent check. **Fixed:** the label is now "Verified on [date]".
5. MINOR, `rentingGuide.ts:54`: "allowed only through owners or licensed operators" was too short for the permit and occupancy rules. **Fixed:** it now says permitted homes, within space and occupancy limits, and to check the specific home.

Round 2: VERDICT FINDINGS(1): only finding 3 again, which stays open until the owner confirms or corrects the Verified wording.
