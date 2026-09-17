import { Easing } from 'react-native-reanimated';

// Shared entrance feel for staggered lists (Feed, Discover, Inbox,
// Notifications, Offers, Communities, chat messages, ...) — a plain
// ease-out settle with no overshoot, deliberately calmer than the
// spring-bounce used for immediate feedback (taps, bottom sheets, the
// like burst) elsewhere in the app.
export const calmDuration = 340;
export const calmEasing = Easing.out(Easing.cubic);
