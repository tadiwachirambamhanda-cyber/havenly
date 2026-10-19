import { INTEREST_CATEGORIES, INTEREST_OPTIONS } from '@/constants/interests';

// Shared between CreatePostScreen and CreateEventScreen — the same topic
// vocabulary posts and events are tagged with.
export const TAG_OPTIONS = [
  'Cafés', 'Fashion', 'Nightlife', 'Fitness', 'Beach Days', 'Study Spots', 'Travel', 'Events', 'Padel', 'Beauty',
  'Football', 'Running', 'Art & Culture', 'Gaming',
];

// The same 14 topics in the four groups onboarding uses, so pickers show a
// few short lists (3–4 each) instead of one block of 14 (Miller's Law).
export const TAG_GROUPS: { label: string; tags: string[] }[] = INTEREST_CATEGORIES.map((c) => ({
  label: c.label,
  tags: c.keys.map((k) => INTEREST_OPTIONS.find((o) => o.key === k)!.label),
}));
