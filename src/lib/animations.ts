import {
  Easing, Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
} from 'react-native-reanimated';

// Shared entrance feel for staggered lists (Feed, Discover, Inbox,
// Notifications, Offers, Communities, chat messages, ...) — a plain
// ease-out settle with no overshoot, deliberately calmer than the
// spring-bounce used for immediate feedback (taps, bottom sheets, the
// like burst) elsewhere in the app.
export const calmDuration = 340;
export const calmEasing = Easing.out(Easing.cubic);

// Parallax hero: scrolling down slides the hero up more slowly than the
// page (a lag, not a 1:1 match) and dims it slightly; pulling down past the
// top (iOS bounce, negative offset) scales it up to fill the extra
// rubber-band space instead of showing a gap. Shared by every detail
// screen's hero (Event/Offer/PostDetail) so the feel — and any future tweak
// to it — stays identical instead of drifting across hand-copied versions.
export function useParallaxHero(heroHeight: number) {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const heroAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [0, heroHeight], [0, -heroHeight / 3], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-heroHeight, 0], [2, 1], Extrapolation.CLAMP) },
    ],
  }));
  const heroDimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, heroHeight], [0, 0.35], Extrapolation.CLAMP),
  }));
  return { onScroll, scrollY, heroAnimatedStyle, heroDimStyle };
}
