import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Keeps the Supabase session (access + refresh tokens) in the device's
// encrypted keychain instead of plain AsyncStorage. Web has no keychain
// equivalent, so it falls back to AsyncStorage there — same as Supabase's
// own React Native guide recommends.
export const secureStorage = {
  getItem: (key: string) => (Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key)),
  setItem: (key: string, value: string) => (Platform.OS === 'web' ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value)),
  removeItem: (key: string) => (Platform.OS === 'web' ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key)),
};
