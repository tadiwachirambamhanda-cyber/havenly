import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AnimatedPressable from '@/components/AnimatedPressable';

interface Props {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

// Centralizes the back button's interactive contract — hitSlop, the
// goBack() action, and the accessibility label — so a future tweak to any
// of them lands everywhere at once instead of needing to be hand-applied
// across every screen. Visual styling (position, size, background) still
// varies per screen via `style`/`children`.
export default function BackButton({ style, children }: Props) {
  const navigation = useNavigation();
  return (
    <AnimatedPressable style={style} onPress={() => navigation.goBack()} accessibilityLabel="Go back" hitSlop={8}>
      {children}
    </AnimatedPressable>
  );
}
