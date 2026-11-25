# Feature list: Havenly, student housing and student community in Dubai

Source: `docs/prd.md` (v2, 2026-11-25). One row per feature, in build order: data first, then the screens that use it.

## Housing v1 (built)

| ID | Feature (what a person can do or see) | Done check (an action and what they see) | Version | Status |
|---|---|---|---|---|
| F1 | Listings record the kind of place (student residence, room in a shared apartment, private room, studio, or a whole 1, 2 or 3 bedroom home), the number of bedrooms, the extra costs (deposit, fees), a "Verified by Havenly" flag and an optional permit number. The team can set all of these. | As admin I open Manage housing, edit a listing, set the type to "Private room", add a deposit of AED 1,000 and tick Verified. I save, reopen it, and all three are still there. | v1 | done (merged 2026-11-18) |
| F2 | The team can add a listing of any of the five kinds, with photos, price, area, nearby universities and amenities. | As admin I add a "Studio" with 3 photos and a monthly price. It appears in the Housing list and opens with all 3 photos. I add a 3 bedroom home at AED 9,000 a month and its page shows about AED 3,000 each. | v1 | done (merged 2026-11-18 to 11-19) |
| F3 | A listing page shows the full picture: photo gallery, price plus deposit and fees, what is included, commute to each nearby university, a "Verified by Havenly" mark only when verified, and Open in Maps. | I open a verified listing and see the gallery, the real total cost to move in, the commute to each nearby university and the Verified mark. I open an unverified one and there is no mark. | v1 | done (merged 2026-11-18 to 11-19) |
| F4 | Housing is the first tab and the screen the app opens on, with the social features behind it. | I log in and the first screen is student housing search, not the feed. The feed, Discover, Inbox and Profile are still one tap away. | v1 | done (merged 2026-11-18 to 11-19) |
| F5 | Search and filters: area, nearby university, price range, type of place, bedrooms (1, 2, 3), mixed / female only / male only, amenities, and sort by price or by newest. | I choose "Private room", under AED 3,000 a month and "Female only". I then choose "2 bedroom home" and see only 2 bedroom homes. Only matching listings stay. I sort by price low to high and the cheapest is first. I clear the filters and everything returns. | v1 | done (merged 2026-11-18 to 11-19) |
| F11 | Bills on every listing: included or not, and when not, an estimated monthly range (for example AED 450 to 700 for the whole home). A "Bills included" badge and filter. | I open a listing with bills excluded and see the estimated range. I switch the filter to "Bills included" and only listings with bills included remain. | v1 | done (merged 2026-11-18 to 11-19) |
| F12 | Rent split for a whole home: the student picks how many people share (up to the bedrooms or more) and sees each person's monthly share of rent, bills (or the bills range) and deposit. | On a AED 9,000, 3 bedroom home with bills estimated at AED 450 to 700, I choose 3 people and see about AED 3,150 to 3,233 each per month. I change to 2 people and the numbers update. | v1 | done (merged 2026-11-18 to 11-19) |
| F13 | Student deals: the team can add a student offer to a listing (student rate, waived deposit or fees, free first month, group discount), shown as a "Student deal" tag. Listings that include bills or have a student deal get a "Student-friendly" badge and rank higher in search. | As admin I add a student rate to a listing. A student sees "Student rate AED 3,200, normal AED 3,500" and the badge, and that listing sits above an identical one with no deal. | v1 | done (merged 2026-11-18 to 11-19) |
| F6 | Anyone can browse and open the real listings without an account, separate from the sample-only demo mode that already exists ("Explore without signing up", which never touches the database). Sign-in is asked for only when they save or send an enquiry. | In a fresh private window I open the site, see the listings, open one, then tap Enquire and am asked to sign in. After signing in I land back on the same listing. | v1 | done (merged 2026-11-18 to 11-19) |
| F7 | Save listings and compare up to three side by side (price, type, area, commute, included items, verified). Compare is removed in v2 (F17). | I save 3 listings, choose Compare, and see them in three columns. I try to add a fourth and am told the limit is three. | v1 | done (merged 2026-11-18 to 11-19) |
| F8 | Send an enquiry or ask for a viewing, and follow its status. | I send an enquiry on a listing. It shows as Sent in My enquiries. The admin marks it "Contacted" and I see "Residence in touch". | v1 | done (merged 2026-10-14) |
| F9 | The team tracks each enquiry from new to signed and the referral fee owed. | As admin I mark an enquiry Signed with a contract value and the fee amount is calculated and shown. | v1 | done (merged 2026-10-14) |
| F10 | Real listings in place: the first real residences and rooms from the founder, with their own photos, prices and a clearly marked sample set removed. | I open the Housing tab and see only real listings. Every photo is of the actual place. | v1 | not started |

## v2: one look, community, simpler housing

| ID | Feature (what a person can do or see) | Done check (an action and what they see) | Version | Status |
|---|---|---|---|---|
| F14 | The new vibrant look, designed first and approved by the founder, applied to every screen; tabs are Housing, Community, Saved, Inbox, Profile, and the app still opens on Housing. | I open the app on my phone and at 1440 wide: it lands on Housing, the new colours and type are on every screen, and a Community tab sits second. Light and dark both read clearly. | v2 | not started |
| F15 | Demo mode is gone: "Explore without signing up" now simply shows the real listings, and nothing in the app runs on sample content. | In a private window I tap "Just looking?" and see the real Housing list with a sign-in prompt only when I save or enquire. No "Demo mode" banner appears anywhere. | v2 | not started |
| F16 | Housing is simpler: search, price, kind of place and who it is for are up front, the rest sits under "More filters"; the rent split shows on a whole-home listing page instead of a sheet. | On Housing I see four controls and a "More filters" button that opens bills, deal, bedrooms and Verified. On a 3 bedroom home I change people from 3 to 2 on the page and each share updates. | v2 | not started |
| F17 | The in-app Map and Compare are removed; each listing keeps "Open in Maps" and its commute times. | I find no Map or Compare button anywhere. On a listing, "Open in Maps" opens the place in the phone's maps. | v2 | not started |
| F18 | University communities: a list of communities with my university first; I can join or leave any of them; inside one I see its posts. | Signed in as a student at university A, I open Community, see A first, join B, and B's posts appear. I leave B and it moves out of "My communities". | v2 | not started |
| F19 | Posts inside a community: text and up to 4 photos, like and comment, delete my own; each post shows the poster's name, photo and university. | I post "Anyone near DIAC?" with a photo in B. Another student likes and comments; I see both. I delete my post and it is gone for both of us. | v2 | not started |
| F20 | Area questions: when posting, I can tag an area or a listing; that listing's page (and every listing in that area) shows "Students talking about this area" with those posts. | I tag my post "JLT". I open a JLT listing and my post is under "Students talking about this area"; tapping it opens the post. | v2 | not started |
| F21 | The housemates board lives in Community, inside each university's community, with the same matching rules. | I open my university's community, tap Housemates, and see only cards whose preferences match mine. Profile no longer has a Housemates block. | v2 | not started |
| F22 | Events: see upcoming events in a community, open one, and mark "Going". | I open an event, tap Going, and the count goes up by 1; I tap again and it goes back. Past events no longer show. | v2 | not started |
| F23 | Student perks: discounts from brands shown in Community; the team adds brands and perks. | As admin I add a perk "15% off at Sample Cafe". As a student I see it in Community, open it and see how to use it. | v2 | not started |
| F24 | Report and review: anyone signed in can report a post, comment or event; the team sees a queue and can hide or keep each item. | I report a comment. As admin I open the review queue, see it with the reason, tap Hide, and the comment disappears for everyone. The reporter's name is not shown to the poster. | v2 | not started |
| F10 | (still open, from v1) Real listings in place from the founder. | As in v1. | v2 | not started |

Rules:

- F14 is designed first: the founder approves the Housing home and Community designs before any screen changes.
- F15 to F17 are removals; F18 to F24 need F14's shared foundation (tab, theme, data) merged first.
- Status is one of: not started, in progress, done (merged to main).

## Lanes (v2)

| Lane | Features | Notes |
|---|---|---|
| Chief Architect (foundation) | F14 design and shared look, Community tab, F15, F17, the database for F18 to F24 | Merged first |
| Lane A: housing | F16, the housing screens restyled to F14 | `docs/lanes/lane-a.md` (rewritten for v2) |
| Lane C: community | F18 to F24 | `docs/lanes/lane-c.md` (new) |
| The founder | F10, design approval, community rules | Content and decisions, not code |

## Later

- Notifications when someone comments on or likes my post.
- Signed-out visitors reading communities.
- A global feed or following people; video posts; check-ins and pings.
- Map search with pins on a real map.
- Agents and residences get their own login, add their own listings and pay a listing fee.
- A provider dashboard; email or WhatsApp alerts to providers; push notifications (needs a development build).
- Student reviews and ratings of places; virtual tours; Arabic.
- Payments, deposits and contract signing in the app.
- Move-in credit from Havenly's fee (lawyer first); uneven rent splits; automatic student checks.
