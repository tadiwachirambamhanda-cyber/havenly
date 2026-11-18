import React, { useEffect, useRef } from 'react';
import Icon from '@/components/Icon';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { HEART_DOWN, HEART_PEAK, HEART_UP } from '@/theme/motion';

interface Props {
  active: boolean;
  size: number;
  color: string;
  activeColor: string;
}

// Shared by every heart-shaped toggle button in the app (post likes, event
// interest) so liking something always feels the same — a quick overshoot
// bounce, only on the way to active. Unliking stays quiet on purpose:
// PostDetailScreen's own like button set this precedent first.
export default function BurstHeart({ active, size, color, activeColor }: Props) {
  const scale = useSharedValue(1);
  // Tracks the previous `active` value so a heart that mounts already-active
  // (e.g. an event the user was already interested in) doesn't bounce on
  // load — only a real false-to-true transition should.
  const wasActive = useRef(active);

  useEffect(() => {
    if (active && !wasActive.current) {
      scale.value = withSequence(
        withTiming(HEART_PEAK, HEART_UP),
        withTiming(1, HEART_DOWN),
      );
    }
    wasActive.current = active;
  }, [active, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <Icon name="heart" size={size} color={active ? activeColor : color} weight={active ? 'fill' : undefined} />
    </Animated.View>
  );
}
