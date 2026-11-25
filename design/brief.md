# Design brief: Havenly v2

For: Claude Design. From: the Havenly founder (via the coding agent). Date: 2026-11-25. Needed back by: the founder's review of the first two screens. Replaces the housing-only brief of 2026-11-18 (in git history; its handoff is in `design/handoff/v1-housing/`).

## What this is and who uses it

Havenly is where university students in Dubai find somewhere to live and the students to ask about it: real listings with the real monthly cost, plus university communities where students post, ask about areas, find housemates, events and perks. One app, two jobs, one look.

The one person it is for: **Layla, 19, first year at a Dubai university, new to the city.** She wants a room under AED 3,000 a month near campus, and she wants to ask other students whether Al Barsha is a good area and whether anyone needs a flatmate. She is on her phone most of the time.

## Read these first

Screen map: `docs/ux/screen-map.md`. Plan: `docs/prd.md`, `docs/feature-list.md` (F14 to F24). Logo: `design/brand/README.md`. The earlier housing handoff `design/handoff/v1-housing/README.md` shows the layouts the founder already approved: keep what works there (price first, photo-led cards), change the look.

Inspiration images in `design/reference/`: none. Take the energy of student and social apps (bold colour, friendly type, lively cards) and the clarity of listing apps (big photo, price up front), not either one's clutter.

## Screens to design

From the screen map, each with its states:

- `Housing` (home)
- `Community` (tab)
- `ResidenceDetail`
- `CommunityDetail`
- `CreatePost` (sheet)
- `ReviewQueue` (team)

## Rules that cannot bend

1. **One primary action per screen**, named in the screen map; nothing else looks as important.
2. **Price first on housing.** Every result card and listing page shows the monthly price and what it includes at a glance.
3. **Housing and Community look like one app:** same type, colours, cards and tab bar; Community may lean on the second colour, never a different style.
4. **Every post shows who wrote it and their university**, and every post, comment and event has a visible Report action.
5. **Works at 390 and 1440 wide**, light and dark, with no sideways scroll, readable contrast (4.5:1 for text), and every screen shows its empty, loading and error states.
6. **No AI-template look:** no emoji as icons, no numbered section labels, no three-identical-icon-card grids, no decorative glows or pulsing dots, no hype headlines.

## Brand direction (decided by the founder, 2026-11-25)

- **Keep the logo** (the roof-h mark and the lowercase `havenly` wordmark); it takes the new main colour.
- **Colours:** evolve today's oxblood into a brighter, juicier **berry red** as the main colour; **mint** as the second colour, for community moments (likes, Going, joined); **sun yellow** for student deals and perks. Grounds: warm off-white (light) and near-black (dark). Verified stays visually distinct from deals.
- **Feel, in three words:** lively, trustworthy, student.
- Type may change; today's is Schibsted Grotesk (headings) and Hanken Grotesk (text). If you change it, say why.

## Words to use (and never use)

Use: **listing**, **student residence**, **private room**, **studio**, **whole home**, **per month**, **bills included / not included**, **deposit**, **Verified by Havenly**, **student deal**, **enquire**, **book a viewing**, **community**, **post**, **comment**, **join**, **housemates**, **events**, **Going**, **perks**, **Get code**, **report**, **Students talking about this area**, **Havenly team**.

Never use: "property" for a room, "unit", "tenant", "lead", "feed", "followers", "luxury", "exclusive", "dream home", "AI-powered", "seamless", "unlock", "vibes".

## You decide

Layout, exact colours within the direction above, typography, components, how Community feels. If you change anything above, tell us why.

## Real content for the mock-ups

Fictional but UAE-real. Listings are clearly samples ("Sample, not a real place"). People are invented first names. Real areas: Dubai Knowledge Park, Dubai International Academic City, Dubai Silicon Oasis, Al Barsha, Jumeirah Lake Towers, Dubai Marina. Universities from the app's list: American University in Dubai, University of Wollongong in Dubai, Murdoch University Dubai, Heriot-Watt University Dubai, Canadian University Dubai.

- Private room, Al Barsha: AED 2,800 per month, bills included, deposit AED 1,000, Verified.
- Studio, Dubai Silicon Oasis: AED 3,600 per month, bills not included (about AED 350 to 500), student deal AED 3,300.
- Whole 3 bedroom home, Jumeirah Lake Towers: AED 9,000 per month, bills about AED 450 to 700 for the home, deposit AED 4,500; 3 people pay about AED 3,150 to 3,233 each.
- Post in Murdoch University Dubai by Sara (Murdoch University Dubai), tagged Jumeirah Lake Towers: "Anyone living in JLT? How long is the bus to Knowledge Park in the morning?" 4 comments, 12 likes.
- Post by Omar (Canadian University Dubai) in the same community: "Need one more housemate for a 3 bed in JLT from January, AED 3,100 each."
- Event (by the Havenly team): "Move-in day meetup, Dubai Knowledge Park", Saturday 7 pm, [N] going.
- Perk: "15% off at Sample Cafe, Knowledge Park", Get code.
- Review queue: a comment reported 3 times for "spam", hidden by reports.
Amounts that vary live use slots like `[N]`.

## Send back

Into `design/handoff/`: one `.dc.html` prototype per screen, a screenshot of each, and a `README.md` written to the coding agent: tokens with exact values (colours for light and dark, type sizes, spacing, radii), each screen's parts and states, and a short note on your choices.

## Order of work and review stops

Show the style on two screens first, **`Housing` and `Community`**, and stop for the founder's review. Then design the rest.

## What gets judged

Can Layla tell within three seconds what a place costs per month and how far it is from campus, and does Community make her want to post her question? Both screens must feel like the same app.
