import React, { useEffect } from 'react';
import { Feather } from '@expo/vector-icons';
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

  useEffect(() => {
    if (active) {
      scale.value = withSequence(
        withSpring(1.35, { damping: 6, stiffness: 260 }),
        withSpring(1, { damping: 6, stiffness: 260 }),
      );
    }
  }, [active, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <Feather name="heart" size={size} color={active ? activeColor : color} />
    </Animated.View>
  );
}
