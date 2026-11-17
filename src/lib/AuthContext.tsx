import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { setCrashReportingUser } from '@/lib/crashReporting';
import { enterGuestMode, exitGuestMode, isGuestMode, subscribeGuestMode } from '@/guest/guestState';
import { GUEST_PROFILE, GUEST_SESSION } from '@/guest/fixtures';
import type { Profile } from '@/types';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  // Guest mode: a read-only demo on sample content, with no real session.
  isGuest: boolean;
  enterGuest: () => void;
  exitGuest: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(isGuestMode());

  // The guest flag lives outside React so the Supabase switch can read it on every
  // call; this keeps the screens in step with it.
  useEffect(() => subscribeGuestMode(() => setIsGuest(isGuestMode())), []);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    // No error but no row means the account itself is gone (deleted, maybe
    // from another device) while this device still holds its session —
    // without signing out, RootNavigator waits on a profile forever. A
    // network error is left alone so a flaky connection never logs anyone out.
    if (!error && !data) {
      await supabase.auth.signOut();
      return;
    }
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => { setCrashReportingUser(session?.user.id ?? null); }, [session?.user.id]);

  const refreshProfile = useCallback(async () => {
    if (session?.user && !isGuest) await loadProfile(session.user.id);
  }, [session, isGuest, loadProfile]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!mounted) return;
      setSession(initialSession);
      if (initialSession?.user) await loadProfile(initialSession.user.id);
      if (mounted) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      if (nextSession?.user) {
        await loadProfile(nextSession.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // In guest mode the screens see a stand-in session and profile. The real session
  // state above is left untouched, and crash reporting keeps using the real one.
  const value: AuthContextValue = isGuest
    ? { session: GUEST_SESSION, profile: GUEST_PROFILE, loading: false, refreshProfile, isGuest, enterGuest: enterGuestMode, exitGuest: exitGuestMode }
    : { session, profile, loading, refreshProfile, isGuest, enterGuest: enterGuestMode, exitGuest: exitGuestMode };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
