import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/lib/ThemeContext';
import Icon, { type IconName } from '@/components/Icon';

interface Props {
  icon: IconName;
  style?: StyleProp<ViewStyle>;
}

// Stand-in for a listing or offer with no photo yet: the flat photo tone of
// the current theme with a small icon, so it reads as "photo coming".
export default function PhotoPlaceholder({ icon, style }: Props) {
  const { colors } = useTheme();
  const height = Number(StyleSheet.flatten(style)?.height) || 0;
  const iconSize = height && height < 80 ? 16 : 22;
  return (
    <View style={[{ overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style, { backgroundColor: colors.photo }]}>
      <Icon name={icon} size={iconSize} color={colors.inkSoft} weight="regular" />
    </View>
  );
}
