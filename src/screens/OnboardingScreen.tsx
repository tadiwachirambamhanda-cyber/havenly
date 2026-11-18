import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { radius, spacing } from '@/theme/tokens';
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
        <Text style={styles.eyebrow}>Welcome to Havenly</Text>
        <Text style={styles.title}>Find a place near your campus.</Text>
        <Text style={styles.sub}>See the real monthly cost, bills and student deals, compare up to three places, and split the rent with the people you live with.</Text>
      </View>
      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <AnimatedPressable style={styles.btnPrimary} onPress={start} disabled={saving} accessibilityRole="button">
          <Text style={styles.btnPrimaryText}>{saving ? 'Just a moment…' : 'Find a place'}</Text>
        </AnimatedPressable>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  // Fixed dark hero regardless of app theme, so its text stays literal cream.
  container: { flex: 1, backgroundColor: '#1F1B16', justifyContent: 'space-between' },
  hero: { paddingHorizontal: spacing.xl },
  eyebrow: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 11, color: '#E8E2D6', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontFamily: 'SchibstedGrotesk_600SemiBold', fontSize: 34, color: '#F3F0EA', marginTop: 10, lineHeight: 38 },
  sub: { fontSize: 15, color: '#DDD7CB', marginTop: 14, lineHeight: 22, maxWidth: 320 },
  btnPrimary: { backgroundColor: colors.coralFill, minHeight: 52, justifyContent: 'center', borderRadius: radius.button, alignItems: 'center' },
  btnPrimaryText: { color: 'white', fontWeight: '700', fontSize: 16 },
  bar: { paddingHorizontal: 24, paddingTop: 12 },
  });
}
