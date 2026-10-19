import type { IconName } from '@/components/Icon';
import type { Community, Interest } from '@/types';


const INTEREST_ICONS: Record<Interest, IconName> = {
  cafes: 'coffee', fashion: 'shopping-bag', nightlife: 'martini', fitness: 'barbell',
  beach: 'waves', study: 'book-open', travel: 'airplane', events: 'confetti',
  padel: 'tennis-ball', beauty: 'sparkle',
  football: 'soccer-ball', running: 'sneaker', art: 'palette', gaming: 'game-controller',
};

const CAMPUS_ICON: IconName = 'graduation-cap';

export function communityIcon(community: Pick<Community, 'category' | 'related_interest'>): IconName {
  if (community.category === 'campus') return CAMPUS_ICON;
  return (community.related_interest && INTEREST_ICONS[community.related_interest]) || 'users';
}

export function interestIcon(interest: Interest): IconName {
  return INTEREST_ICONS[interest];
}
