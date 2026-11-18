import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { Text } from '@/components/Text';
import { useTheme } from '@/lib/ThemeContext';

// The Havenly logo, as in design/brand/: the roof-h mark and the lowercase wordmark.
// Keep them separate from the Havenly tees brand; do not recolour, outline or add shadows.

// A lowercase "h" whose arch is a pitched roof. `size` is its height in points; the width
// follows (248:348 of the 440-unit design grid). Defaults to the primary colour.
export function RoofH({ size = 48, color }: { size?: number; color?: string }) {
  const { colors } = useTheme();
  return (
    <Svg width={(size * 248) / 348} height={size} viewBox="100 52 248 348" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path
        d="M140 92V360M140 246L224 166L308 246V360"
        fill="none"
        stroke={color ?? colors.coral}
        strokeWidth={62}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// "havenly" in Schibsted Grotesk ExtraBold, lowercase, with a full stop in the primary colour.
export function Wordmark({ size = 24, color, dotColor }: { size?: number; color?: string; dotColor?: string }) {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityLabel="Havenly"
      style={{ fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: size, lineHeight: Math.round(size * 1.15), letterSpacing: -size * 0.03, color: color ?? colors.ink }}
    >
      havenly<Text style={{ color: dotColor ?? colors.coral }}>.</Text>
    </Text>
  );
}
