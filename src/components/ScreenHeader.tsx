import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import BackButton from '@/components/BackButton';
import Icon from '@/components/Icon';
import { useTheme } from '@/lib/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';

// The v2 header for a screen opened on top of a tab (design/handoff/README.md): a 44 px round back
// button and a Schibsted Grotesk 800 title at 30 px, with an optional line under it and an optional
// control on the right.
export default function ScreenHeader({ title, subtitle, right, children }: {
  title: string; subtitle?: string; right?: React.ReactNode; children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createHeaderStyles(colors), [colors]);
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <BackButton style={styles.back}>
        <Icon name="arrow-left" size={18} color={colors.ink} />
      </BackButton>
      <View style={{ flex: 1, minWidth: 0 }}>
        {children ?? (
          <>
            <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
          </>
        )}
      </View>
      {right}
    </View>
  );
}

export const CARD_RADIUS_V2 = 22;

function createHeaderStyles(colors: ColorTokens) {
  return StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, gap: 12 },
    back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 30, lineHeight: 34, letterSpacing: -0.8, color: colors.ink },
    subtitle: { fontSize: 14, color: colors.inkSoft, marginTop: 2 },
  });
}

// Rows grouped in a card, like Profile's cards: white surface, 1 px line border, 22 px radius,
// 52 px rows divided by a line, a chevron icon on rows that open something.
export function rowCardStyles(colors: ColorTokens) {
  return {
    card: { backgroundColor: colors.white, borderRadius: CARD_RADIUS_V2, borderWidth: 1, borderColor: colors.line, marginHorizontal: 20, overflow: 'hidden' as const },
    row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, minHeight: 52, paddingHorizontal: 16 },
    rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
    rowText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: colors.ink, flex: 1 },
    sectionLabel: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase' as const, color: colors.inkSoft, paddingHorizontal: 20, marginTop: 24, marginBottom: 10 },
  };
}
