import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
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

  // The account the profile is being loaded for. A slow load that finishes after the account changed is dropped,
  // so one student's private fields (budget, gender and so on) are never shown under another account.
  const loadingFor = useRef<string | null>(null);
  const loadProfile = useCallback(async (userId: string) => {
    loadingFor.current = userId;
    const [{ data, error }, { data: priv }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      // Gender, budget, move-in month and housemate preference live in their own table that only you can read.
      supabase.from('profile_private').select('budget_aed, move_in_month, housemate_pref, gender').eq('user_id', userId).maybeSingle(),
    ]);
    // No error but no row means the account itself is gone (deleted, maybe
    // from another device) while this device still holds its session —
    // without signing out, RootNavigator waits on a profile forever. A
    // network error is left alone so a flaky connection never logs anyone out.
    if (loadingFor.current !== userId) return;
    if (!error && !data) {
      await supabase.auth.signOut();
      return;
    }
    setProfile(data ? ({ ...(data as Profile), ...(priv ?? { budget_aed: null, move_in_month: null, housemate_pref: null, gender: null }) } as Profile) : null);
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
        loadingFor.current = null;
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
