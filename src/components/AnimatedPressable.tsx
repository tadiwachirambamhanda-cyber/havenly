import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const Base = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children?: React.ReactNode;
}

// The one press-feedback primitive for the whole app — every "best" app's
// buttons/cards visibly settle into a tap rather than just firing an
// onPress with no physical feedback. A spring (not a timing curve) is what
// makes it read as touch-responsive rather than a generic fade.
export default function AnimatedPressable({ style, scaleTo = 0.95, onPressIn, onPressOut, children, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Base
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, { damping: 16, stiffness: 400 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 16, stiffness: 400 });
        onPressOut?.(e);
      }}
      {...rest}
    >
      {children}
    </Base>
  );
}
