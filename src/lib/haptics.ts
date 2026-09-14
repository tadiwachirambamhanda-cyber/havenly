import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// expo-haptics has no web implementation — guard every call so this is
// silently a no-op there instead of throwing, and safe to call from any
// screen without a Platform check at each site.
const isNative = Platform.OS !== 'web';

export const haptics = {
  // Small state changes: like, save, follow/join, tab switch, segmented control.
  tap: () => { if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
  // Submitting something: post, comment, message.
  confirm: () => { if (isNative) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
  success: () => { if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
  warning: () => { if (isNative) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); },
};
