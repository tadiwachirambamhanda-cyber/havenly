import type { Interest } from '@/types';

export const INTEREST_OPTIONS: { key: Interest; label: string }[] = [
  { key: 'cafes', label: 'Cafés' }, { key: 'fashion', label: 'Fashion' },
  { key: 'nightlife', label: 'Nightlife' }, { key: 'fitness', label: 'Fitness' },
  { key: 'beach', label: 'Beach Days' }, { key: 'study', label: 'Study Spots' },
  { key: 'travel', label: 'Travel' }, { key: 'events', label: 'Events' },
  { key: 'padel', label: 'Padel' }, { key: 'beauty', label: 'Beauty' },
  { key: 'football', label: 'Football' }, { key: 'running', label: 'Running' },
  { key: 'art', label: 'Art & Culture' }, { key: 'gaming', label: 'Gaming' },
];

// Groups the same 14 options into a few labeled clusters — a flat list
// this long asks a new user to evaluate 14 options against each other at
// once (Hick's Law: decision time grows with the number of choices).
// Chunking them under headings turns that into four much smaller
// decisions instead, without hiding anything.
export const INTEREST_CATEGORIES: { label: string; keys: Interest[] }[] = [
  { label: 'Food & Style', keys: ['cafes', 'fashion', 'beauty'] },
  { label: 'Going Out', keys: ['nightlife', 'events', 'beach', 'travel'] },
  { label: 'Active', keys: ['fitness', 'padel', 'football', 'running'] },
  { label: 'Campus & Culture', keys: ['study', 'art', 'gaming'] },
];
