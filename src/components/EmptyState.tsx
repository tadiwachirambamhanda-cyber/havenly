import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/lib/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';

interface Props {
  icon: keyof typeof Feather.glyphMap;
  text: string;
  style?: StyleProp<ViewStyle>;
}

export default function EmptyState({ icon, text, style }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={[styles.container, style]}>
      <Feather name={icon} size={22} color={colors.inkSoft} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
    text: { color: colors.inkSoft, fontSize: 13, textAlign: 'center', paddingHorizontal: 32, lineHeight: 19 },
  });
}
