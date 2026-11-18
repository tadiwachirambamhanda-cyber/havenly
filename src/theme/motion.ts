import { Easing } from 'react-native-reanimated';
import { Easing as RnEasing } from 'react-native';

// One set of motion settings for the whole app. Everything is a short timed move that ends exactly where it
// should and never overshoots. Springs were removed because with React Native 0.88 and Reanimated 4.7 they
// swung far past the target and kept wobbling for over a second (the tab highlight left the bar entirely).

// The highlight that slides between the tabs.
export const TAB_SLIDE = { duration: 260, easing: Easing.out(Easing.cubic) } as const;

// A button or card settling into a tap, and coming back.
export const PRESS_IN = { duration: 90, easing: Easing.out(Easing.quad) } as const;
export const PRESS_OUT = { duration: 150, easing: Easing.out(Easing.quad) } as const;

// The little pop when a heart is saved (the one deliberate bounce: up, then straight back to 1).
export const HEART_UP = { duration: 110, easing: Easing.out(Easing.quad) } as const;
export const HEART_DOWN = { duration: 170, easing: Easing.inOut(Easing.quad) } as const;
export const HEART_PEAK = 1.28;

// Sheets sliding up from the bottom.
export const SHEET_IN = { duration: 260, easing: Easing.out(Easing.cubic) } as const;

// The same two for React Native's own Animated (the toast, the swipe-to-act rows).
export const RN_SETTLE = { duration: 200, easing: RnEasing.out(RnEasing.cubic) } as const;
export const RN_TOAST_IN = { duration: 240, easing: RnEasing.out(RnEasing.cubic) } as const;
