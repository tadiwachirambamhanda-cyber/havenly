# Screen map: Havenly, student accommodation in Dubai

One row per screen. Each screen is judged against its row, on a screenshot of the running app. Source: `docs/prd.md` and the v1 features in `docs/feature-list.md`. Housing is the first thing people see; the social part (Feed, Discover, Inbox, Profile) stays but is not redesigned here.

| Route | Type | User | Job (one line) | Main content (must stand out) | Primary action (exactly one) | Other actions | States |
|---|---|---|---|---|---|---|---|
| `Housing` (home) | list | Student (signed out or in) | Find a place that fits budget, area and who it is for. | The result cards: photo, price per month, kind of place, area, commute, bills included, Verified. | Open a listing | Filter and sort; search by university or area; save a listing; compare; open the social part | empty (no match: clear filters), loading, error (retry), signed out (sign in only on save) |
| `ResidenceDetail` | detail | Student (signed out or in) | Decide whether this place is worth an enquiry. | The photo gallery and the true monthly cost: rent plus bills (or the bills range), with deposit and fees shown separately. | Enquire or book a viewing | Save; split the rent (homes); open in Maps; compare; see student deal | loading, error, unavailable (full or hidden), signed out (asked to sign in at Enquire), student deal, Verified or not |
| `SplitRent` (sheet on a whole-home listing) | form | Student (signed out or in) | See what each person pays when friends share a whole home. | Each person's monthly amount: share of rent plus share of bills (or bills range), with the deposit split below. | Enquire about this home | Change the number of people; close | default (people = bedrooms), bills included, bills excluded (range), error (listing missing price) |
| `Compare` | detail | Student (signed in, since saving needs an account) | Choose between up to 3 saved listings. | Three columns side by side: price, kind, area, commute, bills, deposit, Verified. | Enquire on the chosen listing | Remove a listing; add another (max 3); open a listing | empty (nothing saved), loading, error, limit reached (a 4th is refused) |
| `SignInToContinue` (sheet) | form | Signed-out visitor | Make an account only when they want to save or enquire, then carry on where they were. | Why we ask (to save this listing or send this enquiry) and the account form. | Create account | Log in instead; not now | default, error (wrong password, weak password), loading |
| `EditResidence` (team) | form | Havenly team (admin) | Add or edit a listing of any kind. | The kind-of-place choice, the price and photos. | Save listing | Verified switch; add photos; add room types; set bills and student deal | new, loading, error (save failed), validation (what is wrong) |

## Users and access

- **Student (signed out):** a visitor with the link. Can reach Housing, ResidenceDetail, SplitRent. Asked to sign in (SignInToContinue) only to save, enquire, or write in the social part.
- **Student (signed in):** a university student in Dubai. Reaches everything above plus Compare, My enquiries, saved listings and the social tabs.
- **Havenly team (admin):** the founder's team. Signs in, reaches everything a student does plus Manage housing and EditResidence.
