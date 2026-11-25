# Handoff: Havenly housing screens

For the coding agent that builds these screens. Read `design/brief.md`, `docs/ux/screen-map.md` and `design/INSPIRATION.md` first. The design canvas (private link, owner only): https://claude.ai/artifact/KboQ7z1ZjZS6sE2rubYgHK

## What is in this folder

| File | Screen (route in the screen map) | Features |
|---|---|---|
| `Housing.dc.html` | `Housing`, search and results | F4, F5, F11, F12 (card line), F13 (tag) |
| `ResidenceDetail.dc.html` | `ResidenceDetail`, one listing | F3, F7, F8 |
| `SplitRent.dc.html` | `SplitRent`, a sheet on a whole-home listing | F12 |
| `Compare.dc.html` | `Compare`, up to 3 listings | F7 |
| `SignInToContinue.dc.html` | `SignInToContinue`, a sheet | F6 |
| `EditResidence.dc.html` | `EditResidence`, team only | F1, F2, F11, F13 |
| `States.dc.html` | Empty, loading and error states for all six screens | all |
| `screenshots/*.png` | One rendering of each at 2x (390 wide; States is 1290 wide) | |

The `.dc.html` files are plain HTML with inline styles inside an `<x-dc>` tag, so every size, colour and spacing in them is an exact value to read. `{{accent}}` is the one tweakable colour (the primary oxblood, default `#7A2433`). Ignore the `support.js` script line, it belongs to the design canvas. The screenshots were rendered from the same HTML in Chrome.

All names, prices, areas and photos in the mock-ups are fictional ("Sample listing, for design only"). Photos are plain grey blocks on purpose; real photos replace them.

## Tokens (exact values)

Colour (palette name: oxblood and stone)

| Token | Value | Used for |
|---|---|---|
| ground | `#F3F0EA` | screen background (warm stone) |
| surface | `#FFFFFF` | cards, fields, tab bar, sheets |
| surface-soft | `#ECE8DF`, `#E6E1D6` | close buttons, neutral tags, panels |
| photo-placeholder | `#DDD7CB` | empty photo and skeletons |
| ink | `#1F1B16` | text, Verified badge background, selected chips |
| ink-body | `#3A342D` | body paragraphs |
| ink-soft | `#5A544B` | secondary text, icons |
| ink-muted | `#655F55` | small print only (12 px) |
| placeholder | `#6B655A` | input placeholder |
| line-card | `#E2DDD2` | card and tab-bar borders |
| line-divider | `#E8E3D9` | rows inside a card |
| line-field | `#8B8477` | field, chip and outline-button borders (3.7:1 on white, so the control edge is visible) |
| primary | `#7A2433` (oxblood) | the one main button, active filter chip, active tab, selected thumbnail |
| primary-tint | `#F1E9E4` (panel), `#E8E2D6` (tag) with text `#4A4036` | "Bills included" tag, each-person-pays panel |
| deal | background `#F5E2C6`, text `#7A4300` | Student deal tag only |
| error | text `#8E1B12` / `#A3231A`, background `#FCE8E6`, border `#E7B5B0`, always with a "!" icon and words | errors |
| notice | background `#ECE8DF`, border `#8B8477`, text ink, with an "i" icon | neutral notices (for example "full or no longer listed") |
| switch-off | `#BDB6A8` | switch track when off |
| sheet-dim | `#7A756B` (stands in for ink at about 55% over the screen) | dimmed area above a sheet |

Contrast (checked): white text on primary 9.9:1; primary on ground 8.7:1; ink on ground 15.1:1; ink-soft on ground 6.6:1; deal text on deal background 6.3:1; "Bills included" text 7.8:1; field border on white 3.7:1. Errors never rely on colour alone, because the primary is also a red family.

Verified by Havenly is a solid ink (`#1F1B16`) badge with white text and a shield-check icon. It must never share a colour with the Student deal tag.

Type (two families, load from Google Fonts or `@expo-google-fonts`)

| Role | Family and weight | Sizes used |
|---|---|---|
| Headings, prices | Schibsted Grotesk 700 (500/600 for small headings) | screen title 30/1.1 (letter-spacing -0.02em); listing title 27/1.12; sheet title 24 to 26; section heading 19 (600); card price 24; listing price 34; action-bar price 18; split amount 28 |
| Body and UI | Hanken Grotesk 400/500/600/700 | body 15 to 16; secondary 14; small 12 to 13; buttons 15 to 16 (700); chips 14 |
| Caps labels | Hanken Grotesk 700, 12, letter-spacing 0.06em, uppercase | section labels |

Numbers: use tabular numerals (`fontVariant: ['tabular-nums']`) only in Hanken lists and tables (the cost rows, the compare cells). Do not use them on Schibsted prices: it makes the comma look detached ("2 , 800").

Spacing, size and shape: screen side gutter 16; gap between cards 16; card padding 14 (cards) or 16 (cost boxes); photo height on a card 188, gallery 300; thumbnails 76 by 56; chip height 40 (pill); primary button 52 high, radius 12; secondary button 48; form fields 52 (public) and 48 (team form), radius 12 and 10; card radius 14; badge radius 8; sheet radius 22 on top corners; tab bar 68 high. Every tap target is at least 44 by 44. No shadows are used; borders do the separating.

## Components

- **Result card:** photo (188) with save heart (44 round, white) top right, a photo count (`1 / [N]`) bottom right, and the Verified badge or Student deal tag bottom left. Under it: price, "per month", and the Bills included tag on the right; then the kind and area; then commute line, then housemates line. A student deal shows the new price, the old price struck through, and "per month". A whole home shows the home price and, on its own line in the warm brown `#4A4036`, the per-person range.
- **Filter chips:** a horizontally scrolling row. First chip is "Verified by Havenly" (with the shield icon). Selected chips are filled primary with white text.
- **Cost box (listing page):** price large, a line on what bills include, then "To move in" rows (first month, deposit, one-time fees) and a bold total.
- **Compare grid:** three equal columns (114 each at 390 wide), each row has an uppercase label above three cells.
- **Sheets (SplitRent, SignInToContinue):** white, 22 radius top, grabber, 44 round close button, content, one primary button at the bottom.
- **Switch:** 52 by 32, knob 26; on is primary, off is `#B9C1B9`. Build it as a real switch control.
- **Skeletons:** flat `#D6DCD5` blocks, no shimmer.

## Screens, parts and states

1. **Housing.** Parts: wordmark and Log in; title "Find a place near your campus"; search box (university or area); filter chips; result count and sort; result cards; tab bar (Housing, Discover, Feed, Inbox, Profile, Housing first). Primary action: open a listing. States in `States.dc.html`: empty (no match, with Clear filters), loading (two skeleton cards), error (Try again). A signed-out visitor sees all of it; saving a listing opens `SignInToContinue`.
2. **ResidenceDetail.** Parts: gallery with back, share, save and `1 / [N]`; thumbnail strip; Verified and Bills included tags; title; location and Open in Maps; cost box; Add to compare; Getting to campus (minutes by bus or metro); The place (kind, who it is for, flatmates), amenity chips, description; provider and permit number; fixed action bar with the price and one button, "Enquire or book a viewing", and the line "You make a free account when you send this." States: loading, unavailable (banner, similar places), error, student deal and not-yet-verified variants.
3. **SplitRent (sheet, whole homes only).** Parts: title; the "Each person pays" panel (main content); people stepper (default = bedrooms, a hint says so); rent and bills rows split by the number of people; bills as a range when not included; deposit and one-time fees split; a note that it is an equal split; the button "Enquire about this home". States: bills included (single amount), error (price missing).
4. **Compare.** Parts: back and title; three column headers (photo, name, Choose or Chosen, Remove); rows: each person pays, bills, deposit, commute, kind, who it is for, Verified; bottom bar "Enquire about the chosen place" with the "up to 3" note. States: empty, limit reached (a 4th is refused), error. Signed-in only (saving needs an account).
5. **SignInToContinue (sheet).** Title says why ("Make a free account to send your enquiry"); email; password with Show; the password rule line; Create account (primary), Log in instead, Not now; terms line. After success the user returns to where they were. States: wrong password, weak password, creating the account.
6. **EditResidence (team).** The same form as today plus the F1 fields and the F11 and F13 fields: kind of place, bedrooms (whole home), listing details, deposit and one-time fees, bills (included switch, or estimate from and to), student deal (switch, type chips, student rate), Verified switch and permit number, photos, room types, who it is for, what is included, close to, private partner terms. Save in the header and at the bottom (the same action). States: validation, save failed, saving.

## Rules from the brief to check on screenshots

One primary action per screen; price visible first; real photos lead; no sign-in wall; Verified only when earned and never the same colour as Student deal; works at 390 and 1440 wide with no sideways scroll; every screen has its empty, loading and error states; no emoji, no numbered section labels, no icon-card grids, no hype copy.

## What changed from the app today, and why

The app today uses a warm sand ground, coral and teal, Fraunces headings and Plus Jakarta Sans, with a dark theme. The new look is a warm stone ground with warm charcoal text, one deep oxblood for the main action, dark ink for the Verified mark and amber for student deals, in Schibsted Grotesk and Hanken Grotesk. It was chosen on 2026-11-18 from five options (cool green, stone and forest, sand and midnight, oxblood and stone, petrol and stone) because it is warm and premium and does not look like other Dubai property portals or a green wellness brand. The old combination (cream, serif, warm accent) reads as an AI template and suits a social app, while this is a marketplace where price and trust must come first. The shared theme (`src/theme/tokens.ts`) and fonts belong to the Chief Architect's foundation step, not to a lane.

## Not designed yet, so do not invent it

- Dark theme: not drawn. If needed, derive it from these tokens and check contrast, do not guess colours.
- Map view, "fair price for this area" gauge (needs real data), Arabic and right-to-left, a wide laptop layout beyond the existing 480 px column on web, the other social screens (Feed, Discover, Inbox, Profile) beyond their tab labels.
- Real photos, real commute times and real provider names: those come from the Havenly team's data.
