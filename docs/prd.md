# PRD: Havenly, student accommodation in Dubai

For: Havenly (founder-run, pre-launch, Dubai). Written: 2026-11-18. Source: the founder's own idea ("Havenly becomes a student accommodation platform first, like Property Finder or Bayut, but for students in Dubai"), plus the housing v1 already built (2026-10-14) and `docs/havenly-launch-prd.html`.

## The client

Havenly is the founder's own product. It is a small, pre-launch team with a working app (web and phone) and a social layer (feed, communities, events, perks, messages) that already exists. The Housing tab (browse residences, enquire, track deals) shipped as a first version.

## The problem

Students who move to Dubai for university search for a place to live across Property Finder, Bayut, Facebook groups, WhatsApp groups and agents. Those sites are built for adults renting a whole flat, not for a student who wants a room or a bed near campus, a fixed budget, a term start date, and a place that takes students. Students do not know which listings are real, what the full cost is, or how long the commute to their university will be.

## Who uses it

- **Student (searching):** an 18 to 28 year old at a Dubai university, often new to the city, who wants a safe, affordable place near campus and wants to ask or book a viewing without hassle.
- **Havenly team (admin):** adds and edits the listings, answers enquiries, and tracks each student from enquiry to signed contract and the referral fee owed.
- **Housing provider (not a user yet):** a residence operator or licensed agency. Students sign the contract with them offline; they pay Havenly a referral fee per signed student.

## What it must do

1. Housing is the first thing a person sees and the main reason to open the app. The social features stay, but sit behind it.
2. Anyone can browse and open listings without making an account. An account is asked for only when they save or send an enquiry.
3. A student can search and narrow listings by area, university, price, room type, who it is for (mixed, female only, male only) and amenities, and sort the results.
4. Listings cover more than one kind of place: student residence, room in a shared apartment, private room, studio.
5. A listing page gives the full picture: photo gallery, price and what the student pays on top (deposit, fees), what is included, how far it is from each nearby university, and a "Verified by Havenly" mark only when the team has checked the listing.
6. A student can send an enquiry or ask for a viewing, and follow its status. (Built already.)
7. A student can save listings and compare up to three side by side.
8. The Havenly team can add and edit every listing, including the new fields, and track the pipeline and referral fees. (Built already; extended.)

## How the client will judge it

- "I open the app and I land on student housing, not on a social feed."
- "My friend opens the link, finds a room under AED 3,000 a month near their university in under a minute, without signing up."
- "I can tell what the place really costs and how far it is from my campus before I ask."
- "I can see which listings the team has checked."
- "I add a new listing in a few minutes and it shows up for students."

## Constraints

- Platforms: web first (live at havenly-app-zeta.vercel.app, redeploys on every merge to main). The phone app runs through Expo, but Expo Go does not open this project (SDK 57), so testing on a phone needs a development build, which needs an Apple or Google developer account.
- Money: AED. Prices are shown per month, semester or year as the provider sells them. 5% VAT applies where relevant.
- Supabase free tier (pauses when idle), no production database yet.
- Listings must be real. Never invent a place, price or review. Sample listings are clearly marked as samples and removed before real launch.
- English only in v1.
- Pre-launch to-dos the founder deferred still stand: domain and business email, legal entity and contact in `src/constants/legal.ts`, lawyer review of the privacy policy and terms, public policy URL for the app stores.

## Not in this version

The founder has not given an out-of-scope list, so this is a proposal for the founder to confirm. Claude must not build any of it in v1:

- Landlords, agents or residences adding their own listings (the team adds them).
- Taking rent, deposits or any payment in the app.
- Generating, signing or storing tenancy contracts. Contracts stay offline with the provider.
- Taking a cut of rent as a broker. The referral fee from the provider stays the model.
- Map search with pins and a draw-on-map tool.
- Reviews and ratings of places by students.
- Roommate matching, new-listing alerts, push notifications, virtual tours, Arabic.
- New social features, or removing the existing ones.

## Data

- Existing tables: `residences`, `room_types`, `residence_partner_terms` (fee and contacts, admin only), `saved_residences`, `housing_enquiries`. Listing type, extra costs, verification, and permit number are new fields.
- The first real listings come from the founder: the residences already contacted and the rooms from the Havenly Housing WhatsApp and Instagram business (R01 to R03). The founder supplies the photos and prices.
- Students' personal data stays limited to what an enquiry needs: name, phone, move-in month, budget. Nothing real in test data.

## Open questions

1. **Who lists?** Team only for v1, or do residences and agents get their own log-in to add listings soon? (Decides the whole next stage.)
2. **Regulation (lawyer, before public launch):** as far as we know, property adverts in Dubai need a permit number from the regulator (Trakheesi) and renting out shared or partitioned rooms is restricted. Does Havenly need a brokerage licence, or is "provider pays a referral fee, contract is offline" enough? Which listing types are legal to show?
3. **Which kinds of place go in v1:** residences only, or also shared-apartment rooms, private rooms and studios? This PRD assumes all four; confirm.
4. **Who pays?** Today only residences pay a referral fee. Do private landlords or agents pay too? Is it ever free for the provider and paid by the student?
5. **Which areas and universities first?** (Dubai International Academic City, Knowledge Village, Silicon Oasis, Marina and JLT, others.)
6. **Browse without an account:** OK to show full listings and the provider name to people who have not signed up?
7. **The Havenly Housing WhatsApp and Google Form business:** does it move into the app (rooms R01 to R03 become listings, the form is replaced by the enquiry), or run in parallel?
8. **Phone vs web for v1:** is web enough for the first friends and students, with the phone app waiting for the developer accounts?
9. **Name of the social part:** keep "Feed, Discover, Inbox, Profile" as they are, or group them under one "Community" tab?
