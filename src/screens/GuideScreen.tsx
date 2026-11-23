import React, { useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import BackButton from '@/components/BackButton';
import { Notice } from '@/components/housing/parts';
import { GUIDE_DISCLAIMER, GUIDE_SECTIONS, GUIDE_SOURCES } from '@/constants/rentingGuide';
import { useTheme } from '@/lib/ThemeContext';
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';

// Renting in Dubai: a plain guide for a first-time student renter. Open to everyone, no account needed.
export default function GuideScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <BackButton style={styles.back}><Icon name="arrow-left" size={17} color={colors.ink} /></BackButton>
          <Text style={styles.title} accessibilityRole="header">Renting in Dubai</Text>
        </View>

        <View style={styles.pad}>
          <Notice kind="note">{GUIDE_DISCLAIMER}</Notice>

          {GUIDE_SECTIONS.map((s) => (
            <View key={s.id} style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">{s.title}</Text>
              {s.intro ? <Text style={styles.intro}>{s.intro}</Text> : null}
              <View style={styles.card}>
                {s.points.map((p, i) => (
                  <View key={i} style={[styles.point, i > 0 && styles.pointDivider]}>
                    <View style={styles.dot} />
                    <Text style={styles.pointText}>{p}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Where this comes from</Text>
            <View style={styles.card}>
              {GUIDE_SOURCES.map((src, i) => (
                <Pressable
                  key={src.url}
                  style={[styles.source, i > 0 && styles.pointDivider]}
                  onPress={() => Linking.openURL(src.url)}
                  accessibilityRole="link"
                  accessibilityLabel={`${src.label}, opens in your browser`}
                >
                  <Text style={styles.sourceText}>{src.label}</Text>
                  <Icon name="chevron-right" size={14} color={colors.inkSoft} />
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingBottom: 12 },
    back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 26, letterSpacing: -0.5, color: colors.ink, flex: 1 },
    pad: { paddingHorizontal: spacing.lg },
    section: { marginTop: 26 },
    sectionTitle: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 19, color: colors.ink, marginBottom: 8 },
    intro: { fontSize: 14, lineHeight: 20, color: colors.inkBody, marginBottom: 10 },
    card: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
    point: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
    pointDivider: { borderTopWidth: 1, borderTopColor: colors.line },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.coral, marginTop: 8 },
    pointText: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.ink },
    source: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16, paddingVertical: 10 },
    sourceText: { flex: 1, fontSize: 14, lineHeight: 19, color: colors.ink, textDecorationLine: 'underline' },
  });
}
