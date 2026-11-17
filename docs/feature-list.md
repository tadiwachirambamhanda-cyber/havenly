# Feature list: Havenly, student accommodation in Dubai

Source: `docs/prd.md`. One row per feature, in build order: data first, then the screens that use it.

## Features

| ID | Feature (what a person can do or see) | Done check (an action and what they see) | Version | Status |
|---|---|---|---|---|
| F1 | Listings record the kind of place (student residence, room in a shared apartment, private room, studio, or a whole 1, 2 or 3 bedroom home), the number of bedrooms, the extra costs (deposit, fees), a "Verified by Havenly" flag and an optional permit number. The team can set all of these. | As admin I open Manage housing, edit a listing, set the type to "Private room", add a deposit of AED 1,000 and tick Verified. I save, reopen it, and all three are still there. | v1 | not started |
| F2 | The team can add a listing of any of the five kinds, with photos, price, area, nearby universities and amenities. | As admin I add a "Studio" with 3 photos and a monthly price. It appears in the Housing list and opens with all 3 photos. I add a 3 bedroom home at AED 9,000 a month and its page shows about AED 3,000 each. | v1 | not started |
| F3 | A listing page shows the full picture: photo gallery, price plus deposit and fees, what is included, commute to each nearby university, a "Verified by Havenly" mark only when verified, and Open in Maps. | I open a verified listing and see the gallery, the real total cost to move in, the commute to each nearby university and the Verified mark. I open an unverified one and there is no mark. | v1 | not started |
| F4 | Housing is the first tab and the screen the app opens on, with the social features behind it. | I log in and the first screen is student housing search, not the feed. The feed, Discover, Inbox and Profile are still one tap away. | v1 | not started |
| F5 | Search and filters: area, nearby university, price range, type of place, bedrooms (1, 2, 3), mixed / female only / male only, amenities, and sort by price or by newest. | I choose "Private room", under AED 3,000 a month and "Female only". I then choose "2 bedroom home" and see only 2 bedroom homes. Only matching listings stay. I sort by price low to high and the cheapest is first. I clear the filters and everything returns. | v1 | not started |
| F6 | Anyone can browse and open listings without an account. Sign-in is asked for only when they save or send an enquiry. | In a fresh private window I open the site, see the listings, open one, then tap Enquire and am asked to sign in. After signing in I land back on the same listing. | v1 | not started |
| F7 | Save listings and compare up to three side by side (price, type, area, commute, included items, verified). | I save 3 listings, choose Compare, and see them in three columns. I try to add a fourth and am told the limit is three. | v1 | not started |
| F8 | Send an enquiry or ask for a viewing, and follow its status. | I send an enquiry on a listing. It shows as Sent in My enquiries. The admin marks it "Contacted" and I see "Residence in touch". | v1 | done (merged 2026-10-14) |
| F9 | The team tracks each enquiry from new to signed and the referral fee owed. | As admin I mark an enquiry Signed with a contract value and the fee amount is calculated and shown. | v1 | done (merged 2026-10-14) |
| F10 | Real listings in place: the first real residences and rooms from the founder, with their own photos, prices and a clearly marked sample set removed. | I open the Housing tab and see only real listings. Every photo is of the actual place. | v1 | not started |

Rules:

- v1 is what the idea needs to be a housing-first platform, and nothing else.
- Status is one of: not started, in progress, done (merged to main).

## Later

- Map search with pins on a real map (native phone only today; web needs a different map).
- Agents and residences get their own login, add and manage their own listings, and pay a listing fee (model and amount to be decided). This is the next stage after v1; v1 keeps each listing tied to a provider so it can slot in.
- A provider dashboard: their enquiries, views and what they owe Havenly.
- Email or WhatsApp alert to the provider when an enquiry arrives.
- New-listing alerts for students; push notifications (needs a development build).
- Student reviews and ratings of places.
- Roommate matching.
- Virtual tours and video walkthroughs per listing.
- Arabic.
- Payments, deposits and contract signing in the app.
- A "Community" tab that groups Feed, Discover, Inbox and Profile.
