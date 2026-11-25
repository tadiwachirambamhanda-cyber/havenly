import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import Icon from '@/components/Icon';
import BackButton from '@/components/BackButton';
import { useTheme } from '@/lib/ThemeContext';
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';

// A placeholder for the v2 community screens until Lane C builds them (plans/2026-11-25-v2-foundation.md).
// Every new route points here, so navigation and links can be wired before the screens exist.
const TITLES: Record<string, string> = {
  Community: 'Community',
  CommunityDetail: 'Community',
  CreatePost: 'New post',
  PostDetail: 'Post',
  EventDetail: 'Event',
  Perks: 'Perks',
  PerkDetail: 'Perk',
  ReviewQueue: 'Review queue',
  ManageEvents: 'Events',
  ManagePerks: 'Perks',
};

export default function ComingSoonScreen() {
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isTab = route.name === 'Community';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.top}>
        {isTab ? null : <BackButton style={styles.back}><Icon name="arrow-left" size={17} color={colors.ink} /></BackButton>}
        <Text style={styles.title} accessibilityRole="header">{TITLES[route.name] ?? 'Coming soon'}</Text>
      </View>
      <View style={styles.card}>
        <Icon name="users" size={22} color={colors.mintText} />
        <Text style={styles.cardTitle}>Coming soon</Text>
        <Text style={styles.cardBody}>University communities, posts, housemates, events and perks are on their way.</Text>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand, paddingHorizontal: spacing.lg },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 30, letterSpacing: -0.7, color: colors.ink },
    card: { backgroundColor: colors.mintBg, borderRadius: 22, padding: 18, gap: 6 },
    cardTitle: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 17, color: colors.mintText },
    cardBody: { fontSize: 14, lineHeight: 20, color: colors.mintText },
  });
}
