import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/Text';
import Icon, { type IconName } from '@/components/Icon';
import { useTheme } from '@/lib/ThemeContext';
import AnimatedPressable from '@/components/AnimatedPressable';
import { radius } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';

interface Props {
  icon: IconName;
  text: string;
  // The obvious next step, when there is one (clear the filters, write a
  // post), so an empty screen isn't a dead end.
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}

export default function EmptyState({ icon, text, action, style }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={[styles.container, style]}>
      <Icon name={icon} size={22} color={colors.inkSoft} />
      <Text style={styles.text}>{text}</Text>
      {action && (
        <AnimatedPressable style={styles.action} onPress={action.onPress} accessibilityRole="button">
          <Text style={styles.actionText}>{action.label}</Text>
        </AnimatedPressable>
      )}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 10 },
    text: { color: colors.inkSoft, fontSize: 13, textAlign: 'center', paddingHorizontal: 32, lineHeight: 19 },
    action: { marginTop: 4, paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.button, borderWidth: 1.5, borderColor: colors.ink },
    actionText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  });
}
