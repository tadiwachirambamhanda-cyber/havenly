import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { colors, spacing } from '@/theme/tokens';
import type { Interest } from '@/types';

const INTEREST_OPTIONS: { key: Interest; label: string }[] = [
  { key: 'cafes', label: '☕ Cafés' }, { key: 'fashion', label: '👗 Fashion' },
  { key: 'nightlife', label: '🌙 Nightlife' }, { key: 'fitness', label: '💪 Fitness' },
  { key: 'beach', label: '🏖️ Beach Days' }, { key: 'study', label: '📚 Study Spots' },
  { key: 'travel', label: '✈️ Travel' }, { key: 'events', label: '🎧 Events' },
  { key: 'padel', label: '🏓 Padel' }, { key: 'beauty', label: '💄 Beauty' },
];

export default function OnboardingScreen() {
  const { session, refreshProfile } = useAuth();
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
        <Text style={styles.eyebrow}>Welcome to Dubai's feed</Text>
        <Text style={styles.title}>Your city, curated by you.</Text>
        <Text style={styles.sub}>Discover cafés, drops, campus events & weekend plans — picked by people just like you.</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.question}>What are you into?</Text>
        <View style={styles.chipGrid}>
          {INTEREST_OPTIONS.map((opt) => {
            const isSelected = selected.has(opt.key);
            return (
              <Pressable key={opt.key} style={[styles.chip, isSelected && styles.chipSelected]} onPress={() => toggle(opt.key)}>
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable style={styles.btnPrimary} onPress={handleContinue} disabled={saving}><Text style={styles.btnPrimaryText}>{saving ? 'Saving…' : 'Continue'}</Text></Pressable>
        <Pressable onPress={handleSkip} disabled={saving}><Text style={styles.skip}>Skip for now</Text></Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2A2118' },
  hero: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 20 },
  eyebrow: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: '#F0C79A', textTransform: 'uppercase' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 38, color: colors.sand, marginTop: 14, lineHeight: 42 },
  sub: { fontSize: 14.5, color: '#E7D9C8', marginTop: 14, lineHeight: 21, maxWidth: 280 },
  panel: { backgroundColor: colors.sand, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, marginTop: 20 },
  question: { fontFamily: 'Fraunces_600SemiBold', fontSize: 22, color: colors.ink, marginBottom: 16 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 20 },
  chip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 100, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13.5, fontWeight: '600', color: colors.ink },
  chipTextSelected: { color: colors.sand },
  btnPrimary: { backgroundColor: colors.coral, paddingVertical: 16, borderRadius: 100, alignItems: 'center' },
  btnPrimaryText: { color: 'white', fontWeight: '700', fontSize: 15 },
  skip: { textAlign: 'center', marginTop: 12, fontSize: 12.5, color: colors.inkSoft, fontWeight: '600' },
});
