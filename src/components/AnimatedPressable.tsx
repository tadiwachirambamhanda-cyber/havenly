import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { PRESS_IN, PRESS_OUT } from '@/theme/motion';

const Base = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children?: React.ReactNode;
}

// The one press-feedback primitive for the whole app: buttons and cards
// settle slightly into a tap rather than firing with no physical feedback.
// Kept small (0.97 default, 0.92 at most for small icon buttons); a big
// bouncy squish on everything reads as a template effect.
export default function AnimatedPressable({ style, scaleTo = 0.97, onPressIn, onPressOut, children, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Base
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        scale.set(withTiming(scaleTo, PRESS_IN));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, PRESS_OUT));
        onPressOut?.(e);
      }}
      {...rest}
    >
      {children}
    </Base>
  );
}
