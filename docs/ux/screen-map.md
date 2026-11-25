# Screen map: Havenly v2, student housing and student community

One row per screen. Each screen is judged against its row, on a screenshot of the running app. Source: `docs/prd.md` (v2, 2026-11-25) and F14 to F24 in `docs/feature-list.md`. The v1 housing map is in git history; Compare and the Map screen are removed in v2.

Tabs: Housing (opens first), Community, Saved, Inbox, Profile.

| Route | Type | User | Job (one line) | Main content (must stand out) | Primary action (exactly one) | Other actions | States |
|---|---|---|---|---|---|---|---|
| `Housing` (tab, home) | list | Student, signed out or in | Find a place that fits budget, area and who it is for. | Result cards: photo, price per month, kind of place, area, commute, bills, Verified. | Open a listing | Search; price, kind and who-it-is-for filters; More filters; sort; save; renting guide | empty (no match: clear filters), loading, error (retry), signed out (sign in only on save) |
| `ResidenceDetail` | detail | Student, signed out or in | Decide whether this place is worth an enquiry. | Photos and the true monthly cost (rent plus bills or bills range; deposit and fees apart). Whole home: each person's share, inline, with a people stepper. | Enquire or book a viewing | Save; enquire with friends; Open in Maps; "Students talking about this area" (posts tagged with its area or listing) | loading, error, unavailable, signed out (asked to sign in at Enquire), Verified or not, no area posts yet |
| `Community` (tab) | list | Student, signed in | See what is happening in my university and the ones I joined. | My communities, with my university first, and the newest posts from them. | Open a community | Join another community; open a post; see perks and events; start a post | signed out (sign-in prompt with why), no communities joined, loading, error |
| `CommunityDetail` | detail | Student, signed in | Take part in one university's community. | Its posts, newest first, each with name, photo, university and any area tag. | Write a post | Join or leave; switch section: Posts, Housemates, Events, Perks; like, comment, report | not joined (can read, join to post), empty (no posts yet), loading, error |
| `CreatePost` (sheet) | form | Student, signed in | Ask or share something with a community. | The text box and up to 4 photos. | Post | Tag an area or a listing; choose community; cancel | empty (Post disabled), uploading, error (post failed, text kept), too many photos |
| `ReviewQueue` (team) | list | Havenly team (admin) | Clear reported posts, comments and events. | Each reported item with its reasons and count, hidden-by-reports marked. | Hide or keep (per item) | Open the item in place | empty (nothing to review), loading, error |

Also restyled to the new look without new jobs: Saved, Inbox and Chat, Profile, Notifications, My enquiries, the enquiry form and sent screen, group enquiry screens, the renting guide, Post detail, Event detail, Perk detail, the team's listing and enquiry screens.

## Users and access

- **Student (signed out):** a visitor with the link, no sign-in. Reaches Housing, ResidenceDetail and the renting guide. Asked to sign in (the sign-in sheet) to save, enquire or open Community.
- **Student (signed in):** email and password. Reaches everything above plus Community, CommunityDetail, CreatePost, Saved, Inbox, Profile and their enquiries.
- **Havenly team (admin):** signs in like a student, with the admin flag. Reaches everything plus ReviewQueue, the listing form, enquiry pipeline, and adding events and perks.
