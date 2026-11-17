import React, { useMemo } from 'react';
import { StyleSheet, Switch, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import AnimatedPressable from '@/components/AnimatedPressable';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/lib/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';

// Small building blocks for the team's listing form, in the look from
// design/handoff/EditResidence.dc.html: 48 px fields, 40 px chips, a 52 by 32
// switch, 12 px caps section labels. Colours come from the theme tokens.

// Switch track when off (handoff "switch-off"); the theme has no token for it.
const SWITCH_OFF = '#BDB6A8';
const GUTTER = 16;

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    section: {
      fontFamily: 'HankenGrotesk_700Bold', fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase',
      color: colors.inkSoft, paddingHorizontal: GUTTER, paddingTop: 24, paddingBottom: 10,
    },
    field: {
      marginHorizontal: GUTTER, marginBottom: 8, height: 48, borderWidth: 1, borderColor: colors.fieldLine, borderRadius: 10,
      backgroundColor: colors.white, paddingHorizontal: 14, fontSize: 16, color: colors.ink,
    },
    fieldMulti: { height: 96, paddingTop: 12, textAlignVertical: 'top' },
    fieldBad: { borderColor: colors.errorText, borderWidth: 2 },
    chip: {
      minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: colors.fieldLine,
      backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    },
    chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipText: { fontSize: 14, fontWeight: '500', color: colors.ink },
    chipTextOn: { color: colors.white, fontWeight: '600' },
    chipBad: { borderColor: colors.errorText, borderWidth: 2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: GUTTER },
    switchRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: GUTTER, marginBottom: 8, paddingVertical: 12,
      paddingHorizontal: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 12,
    },
    switchTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
    switchHint: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
    hint: { fontSize: 13, color: colors.inkSoft, paddingHorizontal: GUTTER, paddingBottom: 8 },
    two: { flexDirection: 'row', gap: 8, paddingHorizontal: GUTTER },
  });
}

function useStyles() {
  const { colors } = useTheme();
  return { colors, styles: useMemo(() => createStyles(colors), [colors]) };
}

export function SectionLabel({ children }: { children: string }) {
  const { styles } = useStyles();
  return <Text style={styles.section} accessibilityRole="header">{children}</Text>;
}

export function Hint({ children }: { children: string }) {
  const { styles } = useStyles();
  return <Text style={styles.hint}>{children}</Text>;
}

interface FieldProps extends TextInputProps {
  label: string;
  invalid?: boolean;
  multiline?: boolean;
  style?: StyleProp<ViewStyle>;
}

// `label` is the accessible name (the placeholder is only a hint).
export function Field({ label, invalid, multiline, style, ...rest }: FieldProps) {
  const { colors, styles } = useStyles();
  return (
    <TextInput
      accessibilityLabel={label}
      placeholderTextColor="#6B655A"
      multiline={multiline}
      style={[styles.field, multiline && styles.fieldMulti, invalid && styles.fieldBad, style as never]}
      selectionColor={colors.coral}
      {...rest}
    />
  );
}

// Two fields side by side (each takes half the width, 8 apart).
export function TwoUp({ children }: { children: React.ReactNode }) {
  const { styles } = useStyles();
  return <View style={styles.two}>{children}</View>;
}

export function ChipRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { styles } = useStyles();
  return <View style={[styles.chips, style]}>{children}</View>;
}

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  invalid?: boolean;
}

export function Chip({ label, selected, onPress, invalid }: ChipProps) {
  const { styles } = useStyles();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipOn, invalid && !selected && styles.chipBad]}
      onPress={() => { haptics.tap(); onPress(); }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </AnimatedPressable>
  );
}

interface SwitchRowProps {
  title: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

// The bare switch (52 by 32): on is the primary colour, off is a stone grey.
export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const { colors } = useStyles();
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      onValueChange={onChange}
      trackColor={{ true: colors.coral, false: SWITCH_OFF }}
      thumbColor="#FFFFFF"
      // Web only: the thumb colour when on.
      {...({ activeThumbColor: '#FFFFFF' } as object)}
      style={{ width: 52, height: 32 }}
    />
  );
}

export function SwitchRow({ title, hint, value, onChange }: SwitchRowProps) {
  const { styles } = useStyles();
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.switchTitle}>{title}</Text>
        {hint ? <Text style={styles.switchHint}>{hint}</Text> : null}
      </View>
      <Toggle label={title} value={value} onChange={onChange} />
    </View>
  );
}
