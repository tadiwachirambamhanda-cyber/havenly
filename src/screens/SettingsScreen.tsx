import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from '@/components/Text';
import AnimatedPressable from '@/components/AnimatedPressable';
import ScreenHeader, { rowCardStyles } from '@/components/ScreenHeader';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon, { type IconName } from '@/components/Icon';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import type { ThemeMode } from '@/lib/ThemeContext';
import { haptics } from '@/lib/haptics';
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MODE_OPTIONS: { key: ThemeMode; label: string; icon: IconName }[] = [
  { key: 'system', label: 'System', icon: 'smartphone' },
  { key: 'light', label: 'Light', icon: 'sun' },
  { key: 'dark', label: 'Dark', icon: 'moon' },
];

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useAuth();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const row = (label: string, onPress: () => void, first: boolean) => (
    <AnimatedPressable key={label} style={[styles.row, !first && styles.rowDivider]} onPress={onPress} accessibilityRole="button">
      <Text style={styles.rowText}>{label}</Text>
      <Icon name="chevron-right" size={14} color={colors.inkSoft} />
    </AnimatedPressable>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Settings" />

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Appearance</Text>
      <View style={styles.segmentRow}>
        {MODE_OPTIONS.map((opt) => {
          const isSelected = mode === opt.key;
          return (
            <AnimatedPressable
              key={opt.key}
              style={[styles.segment, isSelected && styles.segmentActive]}
              onPress={() => { haptics.tap(); setMode(opt.key); }}
              accessibilityLabel={`${opt.label} appearance`}
            >
              <Icon name={opt.icon} size={14} color={isSelected ? colors.sand : colors.inkSoft} />
              <Text style={[styles.segmentText, isSelected && styles.segmentTextActive]}>{opt.label}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      {/* Grouped under short headings rather than one flat list of up to
          ten rows, so each group is a quick scan (Miller's Law). */}
      <Text style={styles.sectionLabel}>Privacy & safety</Text>
      <View style={styles.card}>
        {row('Blocked accounts', () => navigation.navigate('BlockedUsers'), true)}
      </View>

      <Text style={styles.sectionLabel}>Legal</Text>
      <View style={styles.card}>
        {row('Privacy policy', () => navigation.navigate('Legal', { doc: 'privacy' }), true)}
        {row('Terms of use', () => navigation.navigate('Legal', { doc: 'terms' }), false)}
      </View>

      {profile?.is_admin && (
        <>
          <Text style={styles.sectionLabel}>Havenly team</Text>
          <View style={styles.card}>
            {row('Manage housing', () => navigation.navigate('ManageHousing'), true)}
            {row('Check housemate cards', () => navigation.navigate('HousemateReview'), false)}
            {row('Review reports', () => navigation.navigate('ReviewQueue'), false)}
            {row('Manage events', () => navigation.navigate('ManageEvents'), false)}
            {row('Manage perks', () => navigation.navigate('ManagePerks'), false)}
          </View>
        </>
      )}

      </ScrollView>

    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    ...rowCardStyles(colors),
    segmentRow: {
      flexDirection: 'row', gap: 6, marginHorizontal: spacing.lg, backgroundColor: colors.white,
      borderWidth: 1, borderColor: colors.line, borderRadius: 100, padding: 4,
    },
    segment: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      minHeight: 40, borderRadius: 100,
    },
    segmentActive: { backgroundColor: colors.ink },
    segmentText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, color: colors.inkSoft },
    segmentTextActive: { color: colors.sand },
  });
}
