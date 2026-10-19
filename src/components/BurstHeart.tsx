import React, { useEffect, useRef } from 'react';
import Icon from '@/components/Icon';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

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
        withSpring(1.35, { damping: 6, stiffness: 260 }),
        withSpring(1, { damping: 6, stiffness: 260 }),
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
