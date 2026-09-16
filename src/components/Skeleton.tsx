import React, { useEffect, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';

interface Props {
  style?: StyleProp<ViewStyle>;
}

// A shimmering placeholder block — a soft highlight band sweeps left to
// right on loop instead of the whole block fading in and out, which is
// what separates a "polished" skeleton (Facebook/LinkedIn-style) from a
// plain pulsing box.
export default function Skeleton({ style }: Props) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, false);
  }, [progress]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value * 2 - 1) * width }],
  }));

  return (
    <Animated.View
      style={[{ backgroundColor: colors.sandDeep, borderRadius: 8, overflow: 'hidden' }, style]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', colors.line, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width, height: '100%' }}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}
