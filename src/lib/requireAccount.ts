import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/lib/AuthContext';
import type { AccountReason, RootStackParamList } from '@/navigation/RootNavigator';

// For a screen that signed-out visitors can open (Housing, a listing, the rent split)
// but whose save, enquire and compare buttons need an account. Call it first:
//   if (!requireAccount('enquire', residenceId)) return;
// It returns true when there is a session (a demo guest counts, because guest mode
// blocks the write itself with its own message). Otherwise it opens the
// SignInToContinue sheet and returns false.
export function useRequireAccount() {
  const { session } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return useCallback(
    (reason: AccountReason, residenceId?: string): boolean => {
      if (session) return true;
      navigation.navigate('SignInToContinue', { reason, residenceId });
      return false;
    },
    [session, navigation],
  );
}
