import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/ThemeContext';
import Icon, { type IconName } from '@/components/Icon';

interface Props {
  icon: IconName;
  style?: StyleProp<ViewStyle>;
}

// Stand-in for a listing or offer with no photo yet: a quiet sand tone in
// the current theme with a small icon, so it reads as "photo coming" rather
// than as a loud decorative gradient.
export default function PhotoPlaceholder({ icon, style }: Props) {
  const { colors } = useTheme();
  const height = Number(StyleSheet.flatten(style)?.height) || 0;
  const iconSize = height && height < 80 ? 18 : 28;
  return (
    <View style={[{ overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      <LinearGradient colors={[colors.sandDeep, colors.line]} style={StyleSheet.absoluteFill} />
      {/* Wrapped in a View so it stacks above the absolutely-positioned
          gradient on web too (a bare SVG there paints underneath it). */}
      <View>
        <Icon name={icon} size={iconSize} color={colors.inkSoft} weight="regular" />
      </View>
    </View>
  );
}
