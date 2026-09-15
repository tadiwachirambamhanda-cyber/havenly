import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/lib/ThemeContext';

interface Props {
  style?: StyleProp<ViewStyle>;
}

// A pulsing placeholder block — used to build content-shaped loading states
// (skeleton screens) instead of a bare spinner.
export default function Skeleton({ style }: Props) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[{ backgroundColor: colors.sandDeep, borderRadius: 8, opacity }, style]} />;
}
