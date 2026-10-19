import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/ThemeContext';
import { LEGAL_IS_DRAFT, LEGAL_LAST_UPDATED, PRIVACY_POLICY, TERMS_OF_USE } from '@/constants/legal';
import BackButton from '@/components/BackButton';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'Legal'>;

export default function LegalScreen() {
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const doc = route.params.doc === 'privacy' ? PRIVACY_POLICY : TERMS_OF_USE;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <BackButton style={styles.back}>
          <Feather name="arrow-left" size={17} color={colors.ink} />
        </BackButton>
        <Text style={styles.title}>{doc.title}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 48 }}>
        <Text style={styles.updated}>Last updated {LEGAL_LAST_UPDATED}</Text>
        {LEGAL_IS_DRAFT && (
          <View style={styles.draftNote}>
            <Feather name="info" size={13} color={colors.inkSoft} />
            <Text style={styles.draftText}>Draft — being reviewed before Havenly launches.</Text>
          </View>
        )}
        <Text style={styles.intro}>{doc.intro}</Text>
        {doc.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.paragraphs?.map((p) => <Text key={p} style={styles.paragraph}>{p}</Text>)}
            {section.bullets?.map((b) => (
              <View key={b} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{b}</Text>
              </View>
            ))}
            {section.after?.map((p) => <Text key={p} style={styles.paragraph}>{p}</Text>)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12, paddingHorizontal: spacing.lg },
    back: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 19, color: colors.ink },
    updated: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft, marginTop: 4 },
    draftNote: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 12,
      backgroundColor: colors.sandDeep, borderRadius: radius.sm,
    },
    draftText: { flex: 1, fontSize: 12.5, color: colors.inkSoft },
    intro: { fontSize: 14.5, lineHeight: 22, color: colors.ink, marginTop: 16 },
    section: { marginTop: 24 },
    heading: { fontFamily: 'Fraunces_600SemiBold', fontSize: 17, color: colors.ink, marginBottom: 8 },
    paragraph: { fontSize: 14, lineHeight: 21, color: colors.inkSoft, marginBottom: 8 },
    bulletRow: { flexDirection: 'row', gap: 10, marginBottom: 8, paddingRight: 4 },
    bulletDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.inkSoft, marginTop: 8 },
    bulletText: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.inkSoft },
  });
}
