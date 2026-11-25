// Areas students can tag a post with (an "area question"). A post tagged with an area shows on every
// listing whose area has the same name, so these match the names the team uses for listings. Students
// near the main campuses first, then the rest alphabetically.
export const AREAS = [
  'Dubai Knowledge Park',
  'Dubai International Academic City',
  'Dubai Silicon Oasis',
  'Al Barsha',
  'Jumeirah Lake Towers',
  'Dubai Marina',
  'Al Nahda',
  'Al Quoz',
  'Al Qusais',
  'Bur Dubai',
  'Business Bay',
  'Deira',
  'Discovery Gardens',
  'Downtown Dubai',
  'Dubai Internet City',
  'Dubai Production City',
  'Dubai Sports City',
  'International City',
  'Jumeirah Village Circle',
  'Mirdif',
] as const;

export type AreaName = (typeof AREAS)[number];
