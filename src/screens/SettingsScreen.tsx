import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import type { ThemeMode } from '@/lib/ThemeContext';
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MODE_OPTIONS: { key: ThemeMode; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'system', label: 'System', icon: 'smartphone' },
  { key: 'light', label: 'Light', icon: 'sun' },
  { key: 'dark', label: 'Dark', icon: 'moon' },
];

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleLogout = () => {
    Alert.alert('Log out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}><Feather name="arrow-left" size={17} color={colors.ink} /></Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <Text style={styles.sectionLabel}>Appearance</Text>
      <View style={styles.segmentRow}>
        {MODE_OPTIONS.map((opt) => {
          const isSelected = mode === opt.key;
          return (
            <Pressable key={opt.key} style={[styles.segment, isSelected && styles.segmentActive]} onPress={() => setMode(opt.key)}>
              <Feather name={opt.icon} size={14} color={isSelected ? colors.sand : colors.inkSoft} />
              <Text style={[styles.segmentText, isSelected && styles.segmentTextActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.divider} />

      <Pressable style={styles.row} onPress={() => navigation.navigate('BlockedUsers')}>
        <Text style={styles.rowText}>Blocked accounts</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <View style={styles.divider} />

      <Pressable style={styles.row} onPress={handleLogout}>
        <Text style={[styles.rowText, styles.logoutText]}>Log out</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 16, paddingHorizontal: spacing.lg },
    back: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 19, color: colors.ink },
    sectionLabel: {
      fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft,
      fontWeight: '600', paddingHorizontal: spacing.lg, marginBottom: 10,
    },
    segmentRow: {
      flexDirection: 'row', gap: 6, marginHorizontal: spacing.lg, backgroundColor: colors.sandDeep,
      borderRadius: 100, padding: 4,
    },
    segment: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 9, borderRadius: 100,
    },
    segmentActive: { backgroundColor: colors.ink },
    segmentText: { fontSize: 12.5, fontWeight: '700', color: colors.inkSoft },
    segmentTextActive: { color: colors.sand },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 16 },
    rowText: { fontSize: 14, fontWeight: '600', color: colors.ink },
    chevron: { fontSize: 18, color: colors.inkSoft },
    divider: { height: 1, backgroundColor: colors.line, marginHorizontal: spacing.lg, marginTop: 16 },
    logoutText: { color: colors.coral },
  });
}
