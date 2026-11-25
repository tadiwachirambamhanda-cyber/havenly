import React, { useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/Text';
import Icon, { type IconName } from '@/components/Icon';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useTheme } from '@/lib/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';

// Small pieces the housing screens share, drawn from design/handoff/README.md (v2).

// Shapes from the handoff: cards radius 22, fields 16, chips and buttons are pills.
export const CARD_RADIUS = 22;
export const FIELD_RADIUS = 16;
export const PILL_RADIUS = 100;

// "Verified by Havenly" is always ink: trust never looks like a promotion.
export function VerifiedBadge() {
  const { colors } = useTheme();
  return (
    <View style={[tag.base, { backgroundColor: colors.verifiedBg }]} accessibilityLabel="Verified by Havenly">
      <Icon name="check" size={13} color={colors.verifiedText} />
      <Text style={[tag.text, { color: colors.verifiedText }]}>Verified by Havenly</Text>
    </View>
  );
}

export function NotVerifiedTag() {
  const { colors } = useTheme();
  return (
    <View style={[tag.base, { backgroundColor: colors.tintBg }]}>
      <Text style={[tag.text, { color: colors.tintText }]}>Not yet checked by Havenly</Text>
    </View>
  );
}

// Sun is only for money saving.
export function DealTag() {
  const { colors } = useTheme();
  return (
    <View style={[tag.base, { backgroundColor: colors.dealBg }]}>
      <Text style={[tag.text, { color: colors.dealText }]}>Student deal</Text>
    </View>
  );
}

// Mint is the friendly, people colour: bills included and the rent split.
export function BillsTag() {
  const { colors } = useTheme();
  return (
    <View style={[tag.base, { backgroundColor: colors.mintBg, minHeight: 26 }]}>
      <Text style={[tag.text, { color: colors.mintText }]}>Bills included</Text>
    </View>
  );
}

// A quiet tag, such as the kind of place.
export function QuietTag({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[tag.base, { backgroundColor: colors.tintBg }]}>
      <Text style={[tag.text, { color: colors.ink }]}>{label}</Text>
    </View>
  );
}

const tag = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, minHeight: 28, borderRadius: 14, alignSelf: 'flex-start' },
  text: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 12 },
});

// An error or a notice always has an icon and words, never colour alone.
export function Notice({ kind = 'error', children, style }: { kind?: 'error' | 'note'; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const isError = kind === 'error';
  return (
    <View
      accessibilityRole={isError ? 'alert' : undefined}
      style={[{
        flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: FIELD_RADIUS, borderWidth: 1,
        backgroundColor: isError ? colors.errorBg : colors.white, borderColor: isError ? colors.errorLine : colors.line,
      }, style]}
    >
      <Icon name={isError ? 'alert-circle' : 'info'} size={18} color={isError ? colors.errorText : colors.inkSoft} />
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 19, color: isError ? colors.errorText : colors.ink }}>{children}</Text>
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  height?: number;
}

export function PrimaryButton({ label, onPress, disabled, loading, icon, style, height = 54 }: ButtonProps) {
  const { colors } = useTheme();
  const off = disabled || loading;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={off}
      onPress={onPress}
      style={[{ height, minHeight: 44, borderRadius: height / 2, backgroundColor: off ? colors.inkSoft : colors.coralFill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 20 }, style]}
    >
      {loading ? <ActivityIndicator color="#FFFFFF" /> : icon ? <Icon name={icon} size={18} color="#FFFFFF" /> : null}
      <Text style={{ fontFamily: 'HankenGrotesk_800ExtraBold', fontSize: 16, color: '#FFFFFF' }}>{label}</Text>
    </AnimatedPressable>
  );
}

export function OutlineButton({ label, onPress, disabled, icon, style, height = 48 }: ButtonProps) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[{ height, minHeight: 44, borderRadius: height / 2, borderWidth: 1.5, borderColor: colors.fieldLine, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 18, opacity: disabled ? 0.6 : 1 }, style]}
    >
      {icon ? <Icon name={icon} size={16} color={colors.ink} /> : null}
      <Text style={{ fontFamily: 'HankenGrotesk_700Bold', fontSize: 15, color: colors.ink }}>{label}</Text>
    </AnimatedPressable>
  );
}

// A berry text button with a 44 px target, for secondary actions ("Ask about JLT").
export function TextButton({ label, onPress, icon, color, style }: { label: string; onPress: () => void; icon?: IconName; color?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const tint = color ?? colors.coral;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }, style]}
    >
      {icon ? <Icon name={icon} size={16} color={tint} /> : null}
      <Text style={{ fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, color: tint }}>{label}</Text>
    </AnimatedPressable>
  );
}

// Full-width message for an empty, error or unavailable state with one or two actions.
export function StateBlock({
  icon, title, body, kind = 'note', primary, secondary,
}: {
  icon: IconName; title: string; body: string; kind?: 'error' | 'note';
  primary?: { label: string; onPress: () => void }; secondary?: { label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => stateStyles(colors), [colors]);
  return (
    <View style={styles.wrap} accessibilityRole={kind === 'error' ? 'alert' : undefined}>
      <View style={styles.iconWrap}>
        <Icon name={icon} size={20} color={kind === 'error' ? colors.errorText : colors.inkSoft} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <View style={{ gap: 10, alignSelf: 'stretch', alignItems: 'center' }}>
        {primary ? <PrimaryButton label={primary.label} onPress={primary.onPress} height={50} /> : null}
        {secondary ? <OutlineButton label={secondary.label} onPress={secondary.onPress} /> : null}
      </View>
    </View>
  );
}

function stateStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: { alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 36 },
    iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 20, lineHeight: 25, letterSpacing: -0.4, color: colors.ink, textAlign: 'center' },
    body: { fontSize: 14, lineHeight: 20, color: colors.inkBody, textAlign: 'center' },
  });
}

// The grabber and close button at the top of a sheet.
export function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <View>
      <View style={{ alignItems: 'center', paddingTop: 8 }}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.fieldLine }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 }}>
        <Text style={{ fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 24, letterSpacing: -0.5, color: colors.ink, flex: 1 }}>{title}</Text>
        <AnimatedPressable
          accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.tintBg, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="x" size={18} color={colors.ink} />
        </AnimatedPressable>
      </View>
    </View>
  );
}
