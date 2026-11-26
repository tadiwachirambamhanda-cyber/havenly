import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { Wordmark } from '@/components/Brand';
import { PrimaryButton } from '@/components/housing/parts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';

// One short welcome, then straight to the Housing list. The interest picks that used to
// shape the feed are archived with the feed (tag archive/social-v1).
export default function OnboardingScreen() {
  const { session, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();

  const start = async () => {
    if (!session?.user) return;
    setSaving(true);
    await supabase.from('profiles').update({ has_completed_onboarding: true }).eq('id', session.user.id);
    // RootNavigator switches to MainTabs automatically once the profile reflects this.
    await refreshProfile();
    setSaving(false);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.hero, { paddingTop: insets.top + 52 }]}>
        <Wordmark size={28} />
        <Text style={styles.eyebrow}>Welcome to Havenly</Text>
        <Text style={styles.title}>Find a place near your campus.</Text>
        <Text style={styles.sub}>See the real monthly cost, bills and student deals, compare up to three places, and split the rent with the people you live with.</Text>
      </View>
      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <PrimaryButton label={saving ? 'Just a moment…' : 'Find a place'} onPress={start} disabled={saving} />
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand, justifyContent: 'space-between' },
  hero: { paddingHorizontal: spacing.lg },
  eyebrow: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 13, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 36 },
  title: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 34, letterSpacing: -0.8, color: colors.ink, marginTop: 10, lineHeight: 38 },
  sub: { fontSize: 16, color: colors.inkBody, marginTop: 14, lineHeight: 24, maxWidth: 340 },
  bar: { paddingHorizontal: spacing.lg, paddingTop: 12 },
  });
}
