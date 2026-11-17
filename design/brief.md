# Design brief: Havenly

For: Claude Design. From: the Havenly founder (via the coding agent). Date: 2026-11-18. Needed back by: the founder's review of the first two screens.

## What this is and who uses it

Havenly is becoming the place where university students in Dubai find somewhere to live, like Property Finder or Bayut but built for students: a room, a studio, a share of a whole home or a student residence near campus, with the real monthly cost (bills included wherever possible) and a way to split the rent with flatmates. The social part (feed, events, perks, messages) stays in the app but sits behind housing.

The one person it is for: **Layla, 19, first year at a Dubai university, new to the city.** She has a budget per month, a campus to get to, and maybe two friends to share a home with. She wants to know what a place really costs and how long the commute is, without making an account first. She is on her phone most of the time and sometimes on a laptop.

## Read these first

Screen map: `docs/ux/screen-map.md`. Plan: `docs/prd.md`, `docs/feature-list.md` (v1: F1 to F13).

Inspiration images in `design/reference/`: none yet. Take the quality of listing-first apps (big photos, price up front, quick filters) from Property Finder and Bayut, not their density, banners or ads.

What exists today (context, not a rule): the app uses a warm sand ground, coral and teal accents, Fraunces for headlines and Plus Jakarta Sans for text, with a dark theme. You may keep, adjust or replace this. If you change it, tell us why.

## Screens to design

From the screen map, each with its states:

- `Housing` (home): search and results, with filters and sorting
- `ResidenceDetail`: one listing in full
- `SplitRent` (sheet on a whole-home listing): what each person pays
- `Compare`: up to three listings side by side
- `SignInToContinue` (sheet): the account prompt when someone saves or enquires
- `EditResidence` (team only): the admin form to add or edit a listing

## Rules that cannot bend

1. **One primary action per screen**, named in the screen map. On the listing page it is Enquire; nothing else looks as important.
2. **Price first.** On every card and on the listing page, the monthly price is readable in the first glance, with what it includes (bills in or out, deposit and fees shown separately and clearly). No price hidden behind a tap.
3. **Real photos lead.** The photo is the biggest thing on a result card and on the listing page. No stock-looking illustration, gradient or decorative graphic standing in for a photo; an empty photo state looks plainly empty, not fake.
4. **No sign-in wall.** A signed-out visitor can see Housing, listings and the rent split. The account prompt appears only at Save or Enquire, and explains why.
5. **Verified is earned.** The "Verified by Havenly" mark appears only on listings the team has checked, never as decoration, and it is visually distinct from the student-deal tag.
6. **Works at 390 and 1440 wide** with no sideways scroll, readable contrast, and every screen shows its empty, loading and error states.
7. **No AI-template look:** no emoji as icons, no numbered section labels, no three-identical-icon-card grids, no hype headlines, no decorative glows, pulsing dots or fade-ins on everything. Plain, specific, honest copy.

## Words to use (and never use)

Use: **listing**, **student residence**, **room in a shared apartment**, **private room**, **studio**, **whole home**, **per month**, **bills included / bills not included**, **deposit**, **one-time fees**, **Verified by Havenly**, **student deal**, **enquire**, **book a viewing**, **split the rent**, **commute**, **Havenly team**.

Never use: "property" for a room, "unit", "tenant", "lead", "conversion", "luxury", "exclusive", "dream home", "AI-powered", "seamless", "unlock".

## You decide

Layout, colour, typography, components, and how the Housing, Compare and detail screens feel. If you change anything above, tell us why.

## Real content for the mock-ups

Fictional but UAE-real. Use clearly fictional names (a listing is "Sample, not a real place"). Real area names: Dubai Knowledge Park, Dubai International Academic City, Dubai Silicon Oasis, Al Barsha, Jumeirah Lake Towers, Dubai Marina, Al Quoz. Universities from the app's list (for example Heriot-Watt University Dubai, University of Wollongong in Dubai, Murdoch University Dubai, American University in Dubai). Amounts in AED per month.

- Private room, Al Barsha: AED 2,800 per month, bills included, deposit AED 1,000, Verified.
- Studio, Dubai Silicon Oasis: AED 3,600 per month, bills not included (estimated AED 350 to 500 a month), deposit AED 1,800, student deal: AED 3,300.
- Whole 3 bedroom home, Jumeirah Lake Towers: AED 9,000 per month for the home, bills not included (estimated AED 450 to 700 a month for the home), deposit AED 4,500, split between 3 people: about AED 3,150 to 3,233 each per month.
- Student residence, Dubai Knowledge Park: room from AED 24,000 per year, bills included, campus shuttle.
Amounts that vary live (a count of saved listings, a number of people) use slots like `[N]`.

## Send back

Into `design/handoff/`: one `.dc.html` prototype per screen, a screenshot of each, and a `README.md` written to the coding agent that implements it. The README gives the tokens with exact values (colours, type sizes, spacing), each screen's parts and states, and a short note on your choices.

## Order of work and review stops

Show the style on two screens first, `Housing` and `ResidenceDetail`, and stop for the founder's review. Then design the rest.

## What gets judged

The one question that matters most: **can a student tell, within three seconds of opening a result card, what this place costs per month, what that includes and how far it is from their campus?** Then: the screen contracts, readable contrast, and no sideways scrolling at 390 wide.
