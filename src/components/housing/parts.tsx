import React, { useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from '@/components/Text';
import Icon, { type IconName } from '@/components/Icon';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useTheme } from '@/lib/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';

// Small pieces the housing screens share, drawn from design/handoff/README.md.

export function VerifiedBadge() {
  return (
    <View style={[tag.base, { backgroundColor: '#1F1B16' }]} accessibilityLabel="Verified by Havenly">
      <Icon name="shield-check" size={14} color="#FFFFFF" />
      <Text style={[tag.text, { color: '#FFFFFF' }]}>Verified by Havenly</Text>
    </View>
  );
}

export function NotVerifiedTag() {
  const { colors } = useTheme();
  return (
    <View style={[tag.base, { backgroundColor: colors.sandDeep }]}>
      <Text style={[tag.text, { color: colors.inkBody }]}>Not yet checked by Havenly</Text>
    </View>
  );
}

export function DealTag() {
  const { colors } = useTheme();
  return (
    <View style={[tag.base, { backgroundColor: colors.dealBg }]}>
      <Text style={[tag.text, { color: colors.dealText }]}>Student deal</Text>
    </View>
  );
}

export function BillsTag() {
  const { colors } = useTheme();
  return (
    <View style={[tag.base, { backgroundColor: colors.tintBg }]}>
      <Icon name="zap" size={13} color={colors.tintText} />
      <Text style={[tag.text, { color: colors.tintText }]}>Bills included</Text>
    </View>
  );
}

const tag = StyleSheet.create({
  base: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, minHeight: 28, borderRadius: 8, alignSelf: 'flex-start' },
  text: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 13 },
});

// An error or a notice always has an icon and words, never colour alone.
export function Notice({ kind = 'error', children, style }: { kind?: 'error' | 'note'; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const isError = kind === 'error';
  return (
    <View
      accessibilityRole={isError ? 'alert' : undefined}
      style={[{
        flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1,
        backgroundColor: isError ? colors.errorBg : colors.sandDeep, borderColor: isError ? colors.errorLine : colors.fieldLine,
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

export function PrimaryButton({ label, onPress, disabled, loading, icon, style, height = 52 }: ButtonProps) {
  const { colors } = useTheme();
  const off = disabled || loading;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={off}
      onPress={onPress}
      style={[{ height, minHeight: 44, borderRadius: 12, backgroundColor: off ? colors.inkSoft : colors.coral, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 20 }, style]}
    >
      {loading ? <ActivityIndicator color="#FFFFFF" /> : icon ? <Icon name={icon} size={18} color="#FFFFFF" /> : null}
      <Text style={{ fontFamily: 'HankenGrotesk_700Bold', fontSize: 16, color: '#FFFFFF' }}>{label}</Text>
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
      style={[{ height, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 18, opacity: disabled ? 0.6 : 1 }, style]}
    >
      {icon ? <Icon name={icon} size={16} color={colors.ink} /> : null}
      <Text style={{ fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: colors.ink }}>{label}</Text>
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
        {primary ? <PrimaryButton label={primary.label} onPress={primary.onPress} height={48} /> : null}
        {secondary ? <OutlineButton label={secondary.label} onPress={secondary.onPress} /> : null}
      </View>
    </View>
  );
}

function stateStyles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: { alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 36 },
    iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.sandDeep, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 20, lineHeight: 25, color: colors.ink, textAlign: 'center' },
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
        <Text style={{ fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 24, color: colors.ink, flex: 1 }}>{title}</Text>
        <AnimatedPressable
          accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E6E1D6', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="x" size={18} color={colors.ink} />
        </AnimatedPressable>
      </View>
    </View>
  );
}
