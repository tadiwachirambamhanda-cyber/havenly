import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/ThemeContext';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';

interface Props {
  onRetry: () => void;
}

// Shown instead of a blank screen when a render error escapes every screen.
// Deliberately plain (no navigation, no data) so it can't fail itself.
export default function AppErrorFallback({ onRetry }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <Feather name="alert-triangle" size={22} color={colors.coral} />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>Havenly hit an unexpected error. Try again, and if it keeps happening, close and reopen the app.</Text>
      <Pressable style={styles.button} onPress={onRetry} accessibilityRole="button">
        <Text style={styles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: 12 },
    icon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 22, color: colors.ink, textAlign: 'center' },
    body: { fontSize: 14, lineHeight: 21, color: colors.inkSoft, textAlign: 'center', maxWidth: 320 },
    button: { marginTop: 8, backgroundColor: colors.coral, paddingVertical: 13, paddingHorizontal: 32, borderRadius: radius.pill },
    buttonText: { color: 'white', fontWeight: '700', fontSize: 14 },
  });
}
