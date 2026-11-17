import React, { createContext, forwardRef, useContext } from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  StyleSheet,
  type StyleProp,
  type TextProps,
  type TextInputProps,
  type TextStyle,
} from 'react-native';

// Hanken Grotesk is the body face, but React Native has no global default
// font: any style without a fontFamily silently falls back to the system
// font (SF / Roboto / Segoe), which is what most of the app was rendering
// in. Every screen imports Text/TextInput from here instead of
// react-native, so body copy gets Hanken Grotesk automatically.
//
// Each weight of a custom font is its own family on native, so fontWeight
// is translated to the matching family and reset to normal (otherwise
// Android ignores the family and web fakes a heavier bold on top).
const BODY_BY_WEIGHT: Record<string, string> = {
  '100': 'HankenGrotesk_400Regular',
  '200': 'HankenGrotesk_400Regular',
  '300': 'HankenGrotesk_400Regular',
  '400': 'HankenGrotesk_400Regular',
  normal: 'HankenGrotesk_400Regular',
  '500': 'HankenGrotesk_500Medium',
  '600': 'HankenGrotesk_600SemiBold',
  '700': 'HankenGrotesk_700Bold',
  bold: 'HankenGrotesk_700Bold',
  '800': 'HankenGrotesk_800ExtraBold',
  '900': 'HankenGrotesk_800ExtraBold',
};

function isBodyFamily(family: string | undefined): boolean {
  return !family || family.startsWith('HankenGrotesk_');
}

// The family a parent Text resolved to, so nested Text (a bold name inside
// a sentence, a coloured word inside a Schibsted Grotesk title) inherits correctly.
const ParentFamily = createContext<string | null>(null);

function resolve(style: StyleProp<TextStyle>, parentFamily: string | null): { style: StyleProp<TextStyle>; family: string } {
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return { style, family: flat.fontFamily };
  // Inside a display/mono parent with no weight of its own: inherit as-is.
  if (parentFamily && !isBodyFamily(parentFamily)) return { style, family: parentFamily };
  // Nested with no weight: inherit the parent's body weight.
  if (parentFamily && flat.fontWeight == null) return { style, family: parentFamily };
  const family = BODY_BY_WEIGHT[String(flat.fontWeight ?? '400')] ?? BODY_BY_WEIGHT['400'];
  return { style: [style, { fontFamily: family, fontWeight: 'normal' }], family };
}

export const Text = forwardRef<React.ComponentRef<typeof RNText>, TextProps>(function Text({ style, ...rest }, ref) {
  const parentFamily = useContext(ParentFamily);
  const resolved = resolve(style, parentFamily);
  return (
    <ParentFamily.Provider value={resolved.family}>
      <RNText ref={ref} style={resolved.style} {...rest} />
    </ParentFamily.Provider>
  );
});

export const TextInput = forwardRef<React.ComponentRef<typeof RNTextInput>, TextInputProps>(function TextInput({ style, ...rest }, ref) {
  return <RNTextInput ref={ref} style={resolve(style, null).style} {...rest} />;
});

export default Text;
