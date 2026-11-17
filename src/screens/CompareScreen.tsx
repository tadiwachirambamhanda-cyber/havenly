import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useTheme } from '@/lib/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';
import { spacing } from '@/theme/tokens';

// Empty placeholder registered by the Chief Architect so the route exists. Lane A
// builds this screen from design/handoff/Compare.dc.html (see docs/lanes/lane-a.md).
export default function CompareScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Compare</Text>
      <Text style={styles.body}>This screen is not built yet.</Text>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.sm },
    title: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 24, color: colors.ink },
    body: { fontFamily: 'HankenGrotesk_400Regular', fontSize: 15, color: colors.inkSoft },
  });
}
