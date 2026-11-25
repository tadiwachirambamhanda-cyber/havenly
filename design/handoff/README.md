# Handoff: Havenly v2 look (housing and community)

For the coding agent building F14 to F24. Approved by the founder on 2026-11-25 (Housing and Community first, then the rest). Live canvas: https://claude.ai/artifact/3ae2kXBT5Kjp7SS6DbxWgF (private to the founder; the `.dc.html` files here are the same screens). The v1 housing handoff is kept in `v1-housing/` for layouts that did not change.

Note: the prototypes link between screens in Main → Community → listing → community → new post. In the files here, `Main.dc.html` is saved as `Housing.dc.html`; links inside them still say `Main.dc.html`. No screenshots are saved: open the canvas link, or a `.dc.html` file in the design canvas, to see them.

## Tokens

The app keeps its token names (`src/theme/tokens.ts`); only the values change. New tokens are marked new.

| Token | Light | Dark | Use |
|---|---|---|---|
| `sand` (ground) | `#FBF7F2` | `#141012` | Screen background |
| `white` (surface) | `#FFFFFF` | `#1F191C` | Cards, sheets, fields |
| `ink` | `#1C1418` | `#F6EEF0` | Text, Verified pill (light) |
| `inkSoft` | `#6A5E62` | `#B9AAAF` | Secondary text |
| `line` | `#EDE3DC` | `#33292D` | Card borders, dividers |
| `fieldLine` | `#8E8085` | `#6E5F64` | Field and outline-button edges (3:1) |
| `coral` (accent as text, icons) | `#C8234F` | `#FF6B8E` | Links, icons, the logo's full stop and mark |
| `coralFill` (accent as fill) | `#C8234F` | `#D92B5A` | Primary buttons, selected chips, active tab, your-university card; white text on it |
| `coralSoft` | `#FCE4EA` | `#3D1D27` | Soft berry chips, avatar backgrounds |
| `mintBg` (new) | `#D6F5E8` | `#123A2D` | Community moments: liked, Bills included, Housemates, area tag selected, rent split panel |
| `mintText` (new) | `#0B6B4C` | `#7DECC3` | Text and icons on mintBg |
| `mintFill` (new) | `#0B6B4C` | `#5FE0B1` | "Going" when on; text on it `#FFFFFF` light, `#0B2A20` dark |
| `dealBg` (sun) | `#FFE08A` | `#3D3010` | Student deal tag, perks |
| `dealText` (sun) | `#6B4000` | `#FFD45C` | Text on dealBg; "Get code" button fill (with dealBg as its text) |
| `tintBg` | `#F2E9E2` | `#2B2226` | Quiet tags (kind of place), review chips |
| `photo` (new) | `#EFE3DB` | `#2B2226` | Empty photo boxes |
| `verifiedBg` / `verifiedText` (new) | `#1C1418` / `#FFFFFF` | `#F6EEF0` / `#141012` | "Verified by Havenly" pill: never berry, mint or sun |
| `tabBg` / `tabInk` (new) | `#1C1418` / `#CDBFC4` | `#F6EEF0` / `#3A3034` | Floating tab bar and its inactive items; active item is `coralFill` with white |
| `errorBg` / `errorText` | `#FCE8E6` / `#8E1B12` | `#3A1F1B` / `#FFB4A8` | Errors, "Reported N times", Report in menus |

Contrast checked: text on ground and surface 4.5:1 or better in both themes; white on `coralFill` 5.5:1 (light) and 4.7:1 (dark); mint and sun text on their backgrounds 5.7:1 and 6.9:1.

Type: Schibsted Grotesk 800 for titles and prices (31 px screen titles, 24 to 27 px prices and listing names, 19 px section titles, letter-spacing -0.5 to -0.8 px); Hanken Grotesk for everything else (15 to 16 px body, 13 to 14 px secondary, 700 for labels and buttons). Uppercase 13 px 700 with 0.6 px spacing only for small section labels ("MY COMMUNITIES").

Shape and spacing: 20 px screen gutters; cards radius 22, border 1 px `line`, padding 14 to 16; chips and buttons are pills (radius = half height); touch targets 44 px or more (chips 40, primary buttons 54); gaps 8 / 12 / 16 / 18. The floating tab bar: 70 px tall, radius 35, 14 px from the sides and 22 px from the bottom, five items. Shadows only on the floating "Write a post" button and open menus.

## Screens

**Housing** (`Housing.dc.html`). Logo (mark and wordmark in berry) and the bell with an unread dot. Title "Find your place near campus". Search field. Four pill filters: "Under AED 3,000", "Kind of place", "Who it's for", "More filters" (selected = berry fill). Count and sort. Result cards: photo (178 px) with Verified or Student deal pill top left and the save heart top right; price in 24 px with "per month"; "Bills included" mint chip; name; kind · area; commute line with icon. A mint banner between results: "Not sure about an area? 12 students talking about Al Barsha this week" opens that area in Community. Student deal: rate, then the normal price struck through.

**Community** (`Community.dc.html`). Title and an outline "Post" button. "MY COMMUNITIES": horizontal cards, your university first as a berry card ("Your university · 8 new"), joined ones white, then "Find more". Three shortcuts: Housemates (mint), Events (white), Perks (sun). "LATEST FROM YOUR COMMUNITIES": post cards (avatar initial, name, university · time, ⋯ menu, text, area tag chip with pin, like and comment pills: liked = mint); an event card with a berry date block and "I'm going" (on = mint fill with a tick); a perk card in sun with "Get code".

**Listing page** (`ResidenceDetail.dc.html`). Photo gallery (320 px, back and save, "1 / 8"), then a sheet overlapping it by 24 px. Verified and kind pills, name, area. Cost card: price for the home, bills line, then the mint split panel (people stepper 1 to 10, "About AED X to Y each a month", deposit each), then "To move in" rows and total. "Getting to campus" rows and "Open in Maps". "Students talking about this area": up to 3 tagged posts and "Ask about <area>". Fixed bottom: "Enquire or book a viewing" (primary) and "Enquire with friends" (text button). The split replaces the old SplitRent sheet; the stepper defaults to the number of bedrooms.

**A community** (`CommunityDetail.dc.html`). Berry header with back, Join / Joined, the community's initials, name and "[N] members · Your university". Four section pills: Posts, Housemates, Events, Perks (selected = ink fill). Posts with comments shown under them; the ⋯ menu holds "Report post" (error colour) and "Block <name>". Housemates shows only matching cards with "Message <name>" and "My housemate card". Perks shows the personal code in a dashed box. Floating "Write a post" button.

**New post** (`CreatePost.dc.html`). A sheet over the dimmed screen. Cancel, title, Post (disabled until there is text). "Posting in <community>" picker. Text box. Photos "N of 4" with an add tile. "Tag an area or a listing · optional" with the chosen tag in mint and a note that tagged posts show on that area's listings. Footer note that name, photo and university show, and anyone can report.

**Review queue, team** (`ReviewQueue.dc.html`). Title and "N to review". An explainer line. Each item: kind, "Reported N times" (error), "Hidden by reports" (ink) when auto-hidden at 3, where it was and who wrote it, the text, the reasons, then Hide (primary) and Keep; once decided, a mint line "Hidden for everyone" or "Kept and visible" with Undo. Empty state: "Nothing to review. New reports show up here."

## States to build (not all drawn)

Every screen: loading (skeletons in the card shapes), error (a `StateBlock` with "Try again"), empty (Housing: no matches with "Clear filters"; Community: no communities joined with "Find your university"; a community: "No posts yet. Ask the first question."; listing: no area posts yet, just "Ask about <area>"). Signed out: Community and posting open the sign-in sheet with why. Photos uploading on New post; post failed keeps the text.

## Choices

- Berry `#C8234F` evolves the oxblood: same family, much brighter, still 5:1 with white. The logo takes it.
- Mint is the "people" colour (likes, going, bills included, the split panel), so community and the friendly parts of housing feel related. Sun is only money-saving (deals, perks). Verified stays ink so trust never looks like a promotion.
- Same cards, pills and tab bar in both halves; Community leans on mint and berry blocks, housing on photos and prices.
