# Inspiration board: Havenly housing redesign

Researched 2026-11-18 on Dribbble (through the founder's Chrome). Only Dribbble was searched, and I looked at the top part of each shot, so these are principles, not full teardowns. Nothing here is copied; each line names a principle and how Havenly uses it in its own way.

## What we are designing

The housing-first screens in `docs/ux/screen-map.md`: Housing results, the listing page, the rent split, Compare, the sign-in prompt and the team's edit form. Fixed points: the name Havenly, students in Dubai, price per month in AED, bills included where possible, "Verified by Havenly", student deals, no sign-in wall, no AI-template look (`design/brief.md`).

Questions we wanted answered:
1. How do student-housing concepts build trust in the first glance?
2. How do rental result cards show price and fit without clutter?
3. How do split-the-bill apps make money feel fair rather than awkward?

## References and the principle in each

Trust and student-specific
- [Thola, Student Rental Marketplace](https://dribbble.com/shots/27827426-Thola-Student-Rental-Marketplace): the first filter chip is the trust mark (an accreditation badge), cards carry small "Verified" and "Video" tags, and one line combines distance to campus with the number of housemates. Principle: put the trust signal in the filters and on the card, and say who you would live with, not only where.
- [Student Housing Marketplace](https://dribbble.com/shots/27813464-Student-Housing-Marketplace) (RTL app): one large photo with a small stack of thumbnails beside it, so the place feels like several rooms, not one picture. Principle: show that there is more to see.
- [Mobile UI Design, Student Housing Platform](https://dribbble.com/shots/27272991-Mobile-UI-Design-Student-Housing-Platform): a marketing page that leads with big numbers about students housed. Principle: proof by count, but only when the numbers are real (we have none yet, so we do not copy this).

Result cards and price
- [Rental App: Apartment Search Results](https://dribbble.com/shots/27774250-Rental-App-Apartment-Search-Results): a photo-count marker (2 of 5), the price with "/month" in one line, rooms, size and floor on a single line beneath, and a small "good price" gauge that says whether the price is fair for the area. Principle: one tidy line of specifics under the price, and a price put in context. The gauge needs real comparison data, so it is parked for later.
- Other rental shots in the same search (apartment booking, house rental, listing components): large photo, rounded card, price first, save heart on the photo. Principle: this is the shared grammar of the category; use it so the screen is instantly understood.

Money and splitting
- [SplitMate](https://dribbble.com/shots/26961137-SplitMate-Expenses-Split-Mobile-App) and the other split-the-bill shots (Cost Split, Divy): the promise is emotional ("fair splits, no awkward money talks"), not mathematical. Principle: lead the rent-split screen with the relief, then show each person's amount.

## Overdone, so we avoid it

- Deep plum or black grounds with one loud accent word in italic serif (Thola's headline, SplitMate's lime on black).
- Glassmorphism and blurred panels on result cards.
- Illustrated people, paper planes and bicycles as "student life" decoration, and smiling stock-photo avatars.
- Fake 3D phone mock-ups and floating price bubbles instead of real product screens.
- Marketing-site hero sections for what should be a working app screen.

## Translation: principle to Havenly

| Principle | In Havenly (and what we change so it is our own) |
|---|---|
| Trust signal lives in the filters and on the card | "Verified by Havenly" is the first filter chip and a solid dark badge on the card. It is a Havenly check by the team, not a third-party accreditation, and it never shares a colour with the student-deal tag. |
| One line says where and with whom | The card line reads "18 min to Heriot-Watt University Dubai · 1 housemate", with the commute and the people in one place. |
| Show there is more to see | A photo count ("1 / [N]") on every card and the gallery. |
| Price in one line, specifics under it | Already the card pattern; we add what the price includes (bills in or out) on the same block. |
| Put the price in context | Parked for later: "fair for this area" needs real listing data. It must never be invented. |
| Lead the split with relief | The rent-split sheet will open with "Each person pays [AMOUNT] a month" and a plain line that bills are included or estimated, so nobody has to do the maths or have the awkward conversation. |

All of these keep our own palette, type and copy; none reuses another product's text, colours or signature elements.

## Changes made now (Housing screen)

1. "Verified by Havenly" added as the first filter chip.
2. A photo count on each card.
3. Housemates added to the commute line (1 housemate for the room, 3 housemates for the whole home).

## Queued for the screens still to design

- Rent split opens with the relief line and each person's amount (SplitMate principle).
- Listing page gallery shows a small thumbnail strip beside or below the main photo (Student Housing Marketplace principle).
- "Fair for this area" price gauge: later, once there is enough real data.
