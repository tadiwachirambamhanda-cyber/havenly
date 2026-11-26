import { useCallback, useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';

// Intercepts leaving the screen — the header Cancel button (which just calls
// goBack), the swipe-back gesture, and the hardware back button all go
// through the same navigation event, so this catches all three in one place.
//
// Returns allowLeave(): call it right before a goBack() that follows a
// successful save. Every caller here follows the same shape — set a
// `saved`/`posted`/`created` flag to make isDirty go false, then immediately
// navigation.goBack() in the same synchronous block. That goBack fires
// 'beforeRemove' before React has re-rendered and this hook's effect below
// has re-subscribed its listener with the new isDirty — so the OLD listener
// (still closing over the pre-save isDirty === true) intercepts it and shows
// "Discard changes?" right after a successful save. allowLeave() sets a ref
// synchronously, which the listener checks first, sidestepping the render
// race entirely instead of trying to outrace it.
export function useConfirmDiscard(isDirty: boolean, message = 'Your changes will be lost.') {
  const navigation = useNavigation();
  const bypassRef = useRef(false);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (bypassRef.current || !isDirty) return;
      e.preventDefault();
      // Alert.alert does nothing on the web, so the browser's own confirm box asks there instead.
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(`Discard changes?\n\n${message}`)) navigation.dispatch(e.data.action);
        return;
      }
      Alert.alert('Discard changes?', message, [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
  }, [navigation, isDirty, message]);

  return useCallback(() => { bypassRef.current = true; }, []);
}
