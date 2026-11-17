import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { secureStorage } from '@/lib/secureStorage';
import { createDemoClient } from '@/guest/demoClient';
import { createSwitchingClient } from '@/guest/clientSwitch';
import { isGuestMode } from '@/guest/guestState';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl ?? '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey ?? '';

const realClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Every screen imports this one `supabase`. In guest mode all calls go to an
// in-memory demo client (sample content, every write refused) and the real
// client is never touched; otherwise they go to the real client as before.
export const supabase: SupabaseClient = createSwitchingClient(realClient, createDemoClient(), isGuestMode);
