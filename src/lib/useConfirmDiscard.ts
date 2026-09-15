import { useEffect } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';

// Intercepts leaving the screen — the header Cancel button (which just calls
// goBack), the swipe-back gesture, and the hardware back button all go
// through the same navigation event, so this catches all three in one place.
export function useConfirmDiscard(isDirty: boolean, message = 'Your changes will be lost.') {
  const navigation = useNavigation();

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (!isDirty) return;
      e.preventDefault();
      Alert.alert('Discard changes?', message, [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
  }, [navigation, isDirty, message]);
}
