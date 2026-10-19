import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from '@/components/Text';
import AnimatedPressable from '@/components/AnimatedPressable';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import { INTEREST_OPTIONS, INTEREST_CATEGORIES } from '@/constants/interests';
import { interestIcon } from '@/constants/topicIcons';
import type { Interest } from '@/types';

const optionByKey = new Map(INTEREST_OPTIONS.map((o) => [o.key, o]));

export default function OnboardingScreen() {
  const { session, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selected, setSelected] = useState<Set<Interest>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggle = (key: Interest) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const finishOnboarding = async (interests: Interest[]) => {
    if (!session?.user) return;
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ interests, has_completed_onboarding: true })
      .eq('id', session.user.id);
    // RootNavigator switches to MainTabs automatically once the profile reflects this.
    await refreshProfile();
    setSaving(false);
  };

  const handleContinue = () => finishOnboarding(Array.from(selected));
  const handleSkip = () => finishOnboarding([]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Set up your feed</Text>
        <Text style={styles.title}>Start with what you like.</Text>
        <Text style={styles.sub}>Your picks decide which cafés, drops, campus events and weekend plans show up first.</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.question}>What are you into?</Text>
        <Text style={styles.questionHint}>Pick as many as you like. You can change them later in your profile.</Text>
        {INTEREST_CATEGORIES.map((category) => (
          <View key={category.label} style={styles.categoryGroup}>
            <Text style={styles.categoryLabel}>{category.label}</Text>
            <View style={styles.chipGrid}>
              {category.keys.map((key) => {
                const opt = optionByKey.get(key)!;
                const isSelected = selected.has(key);
                return (
                  <AnimatedPressable key={key} style={[styles.chip, isSelected && styles.chipSelected]} onPress={() => toggle(key)}>
                    <Icon name={interestIcon(key)} size={13} color={isSelected ? colors.sand : colors.ink} />
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{opt.label}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>
        ))}
        <AnimatedPressable style={styles.btnPrimary} onPress={handleContinue} disabled={saving}><Text style={styles.btnPrimaryText}>{saving ? 'Saving…' : 'Continue'}</Text></AnimatedPressable>
        <AnimatedPressable onPress={handleSkip} disabled={saving}><Text style={styles.skip}>Skip for now</Text></AnimatedPressable>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  // Fixed dark hero regardless of app theme (same as Login/SignUp), so its
  // text stays literal cream rather than colors.sand.
  container: { flex: 1, backgroundColor: '#2A2118' },
  hero: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 20 },
  eyebrow: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, color: '#F0C79A', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 38, color: '#FBF5EA', marginTop: 14, lineHeight: 42 },
  sub: { fontSize: 14.5, color: '#E7D9C8', marginTop: 14, lineHeight: 21, maxWidth: 280 },
  panel: { backgroundColor: colors.sand, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, marginTop: 20 },
  question: { fontFamily: 'Fraunces_600SemiBold', fontSize: 22, color: colors.ink },
  questionHint: { fontSize: 12.5, color: colors.inkSoft, marginTop: 4, marginBottom: 20 },
  categoryGroup: { marginBottom: 18 },
  categoryLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.inkSoft, marginBottom: 9 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 100, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
  chipTextSelected: { color: colors.sand },
  btnPrimary: { backgroundColor: colors.coral, paddingVertical: 16, borderRadius: radius.button, alignItems: 'center' },
  btnPrimaryText: { color: 'white', fontWeight: '700', fontSize: 15 },
  skip: { textAlign: 'center', marginTop: 12, fontSize: 12.5, color: colors.inkSoft, fontWeight: '600' },
  });
}
