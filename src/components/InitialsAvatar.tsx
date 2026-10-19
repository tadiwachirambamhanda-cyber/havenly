import React, { useMemo } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/Text';
import { useTheme } from '@/lib/ThemeContext';

interface Props {
  name: string | null | undefined;
  // The same style the photo would use (size, radius, borders), so swapping
  // between a photo and initials never shifts the layout.
  style?: StyleProp<ViewStyle>;
}

function initialsFor(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const letters = words.length === 1 ? [...words[0]].slice(0, 1) : [[...words[0]][0], [...words[words.length - 1]][0]];
  return letters.join('').toUpperCase();
}

// Shown when someone has no profile photo: their initials on a plain sand
// tile (no pastel tint), in place of the old two-colour gradient blob.
export default function InitialsAvatar({ name, style }: Props) {
  const { colors } = useTheme();
  const size = Number(StyleSheet.flatten(style)?.width) || 40;
  const initials = useMemo(() => initialsFor(name), [name]);
  return (
    <View style={[{ backgroundColor: colors.sandDeep, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      <Text
        style={{ color: colors.inkSoft, fontFamily: 'PlusJakartaSans_700Bold', fontSize: Math.max(9, Math.round(size * 0.38)), letterSpacing: 0.3 }}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {initials}
      </Text>
    </View>
  );
}
