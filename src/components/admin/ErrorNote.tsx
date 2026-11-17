import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/Text';
import Icon from '@/components/Icon';
import { useTheme } from '@/lib/ThemeContext';

// An error is always an icon plus words, never colour alone.
export default function ErrorNote({ message, style }: { message: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.box, { backgroundColor: colors.errorBg, borderColor: colors.errorLine }, style]}
    >
      <Icon name="alert-circle" size={20} color={colors.errorText} weight="fill" />
      <Text style={[styles.text, { color: colors.errorText }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 16, marginBottom: 8,
    padding: 12, borderWidth: 1, borderRadius: 12,
  },
  text: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
