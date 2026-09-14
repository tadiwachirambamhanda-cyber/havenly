import type { Feather } from '@expo/vector-icons';
import type { Community, Interest } from '@/types';

type FeatherName = keyof typeof Feather.glyphMap;

// Feather has no literal racket/graduation-cap/soccer-ball/game-controller
// glyphs — padel, campus, football and gaming lean on a reasonable stand-in
// (energy, achievement, flag, cpu) rather than a literal match, same
// tradeoff as everywhere else this app uses Feather over emoji.
const INTEREST_ICONS: Record<Interest, FeatherName> = {
  cafes: 'coffee', fashion: 'shopping-bag', nightlife: 'moon', fitness: 'activity',
  beach: 'umbrella', study: 'book-open', travel: 'compass', events: 'calendar',
  padel: 'zap', beauty: 'star',
  football: 'flag', running: 'wind', art: 'image', gaming: 'cpu',
};

const CAMPUS_ICON: FeatherName = 'award';

export function communityIcon(community: Pick<Community, 'category' | 'related_interest'>): FeatherName {
  if (community.category === 'campus') return CAMPUS_ICON;
  return (community.related_interest && INTEREST_ICONS[community.related_interest]) || 'users';
}

export function interestIcon(interest: Interest): FeatherName {
  return INTEREST_ICONS[interest];
}
