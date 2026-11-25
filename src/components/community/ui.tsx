import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, type StyleProp, type ViewStyle, type TextStyle } from 'react-native';
import { Image } from 'expo-image';
import { Text, TextInput } from '@/components/Text';
import Icon, { type IconName } from '@/components/Icon';
import BackButton from '@/components/BackButton';
import Skeleton from '@/components/Skeleton';
import AnimatedPressable from '@/components/AnimatedPressable';
import InitialsAvatar from '@/components/InitialsAvatar';
import { useTheme } from '@/lib/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';

// Small pieces the Community screens share (design/handoff/README.md: pills, cards radius 22, 20 px gutters).

export const CONTENT_MAX = 720;
export const GUTTER = 20;
export const TITLE_FONT = 'SchibstedGrotesk_800ExtraBold';
export const BOLD = 'HankenGrotesk_700Bold';

// Keeps a screen readable on a wide window: centred, at most 720 px, no sideways scroll.
export function Content({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center' }, style]}>{children}</View>;
}

export function ScreenTop({ title, sub, right, back = true }: { title: string; sub?: string; right?: React.ReactNode; back?: boolean }) {
  const { colors } = useTheme();
  const s = useMemo(() => topStyles(colors), [colors]);
  return (
    <View style={s.row}>
      {back ? <BackButton style={s.back}><Icon name="arrow-left" size={17} color={colors.ink} /></BackButton> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.title} accessibilityRole="header" numberOfLines={2}>{title}</Text>
        {sub ? <Text style={s.sub}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function topStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: GUTTER, paddingBottom: 14 },
    back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: TITLE_FONT, fontSize: 27, letterSpacing: -0.6, color: colors.ink },
    sub: { fontSize: 14, color: colors.inkSoft, marginTop: 2 },
  });
}

export function SectionLabel({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return (
    <Text style={[{ fontFamily: BOLD, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.inkSoft, paddingHorizontal: GUTTER, marginTop: 22, marginBottom: 10 }, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}

type Tone = 'plain' | 'mint' | 'mintFill' | 'ink' | 'berry' | 'sun';

export function Pill({
  label, icon, tone = 'plain', onPress, accessibilityLabel, selected, disabled, style, height = 40,
}: {
  label: string; icon?: IconName; tone?: Tone; onPress?: () => void; accessibilityLabel?: string; selected?: boolean;
  disabled?: boolean; style?: StyleProp<ViewStyle>; height?: number;
}) {
  const { colors } = useTheme();
  const look: Record<Tone, { bg: string; fg: string; border: string }> = {
    plain: { bg: 'transparent', fg: colors.ink, border: colors.line },
    mint: { bg: colors.mintBg, fg: colors.mintText, border: colors.mintBg },
    mintFill: { bg: colors.mintFill, fg: colors.mintOn, border: colors.mintFill },
    ink: { bg: colors.ink, fg: colors.sand, border: colors.ink },
    berry: { bg: colors.coralFill, fg: '#FFFFFF', border: colors.coralFill },
    sun: { bg: colors.dealText, fg: colors.dealBg, border: colors.dealText },
  };
  const l = look[tone];
  const body = (
    <>
      {icon ? <Icon name={icon} size={16} color={l.fg} weight={tone === 'mint' && icon === 'heart' ? 'fill' : undefined} /> : null}
      <Text style={{ fontFamily: BOLD, fontSize: 14, color: l.fg }} numberOfLines={1}>{label}</Text>
    </>
  );
  const boxStyle: StyleProp<ViewStyle> = [{
    height, minWidth: 44, paddingHorizontal: 14, borderRadius: height / 2, borderWidth: 1, borderColor: tone === 'plain' ? colors.fieldLine : l.border,
    backgroundColor: l.bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: disabled ? 0.55 : 1,
  }, style];
  if (!onPress) return <View style={boxStyle}>{body}</View>;
  return (
    <AnimatedPressable
      style={boxStyle} onPress={onPress} disabled={disabled} hitSlop={4}
      accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={selected === undefined ? { disabled } : { selected, disabled }}
    >
      {body}
    </AnimatedPressable>
  );
}

export function Avatar({ name, url, size = 40 }: { name: string | null | undefined; url?: string | null; size?: number }) {
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (url) return <Image source={{ uri: url }} style={style} contentFit="cover" accessibilityIgnoresInvertColors />;
  return <InitialsAvatar name={name} style={style} />;
}

export function CardSkeletons({ count = 3, height = 150 }: { count?: number; height?: number }) {
  return (
    <View accessibilityLabel="Loading" style={{ paddingHorizontal: GUTTER, gap: 12 }}>
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} style={{ height, borderRadius: 22 }} />)}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[{ backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 16, marginHorizontal: GUTTER }, style]}>
      {children}
    </View>
  );
}

export function Field({
  label, value, onChangeText, placeholder, multiline, maxLength, keyboardType, autoCapitalize,
}: {
  label: string; value: string; onChangeText: (t: string) => void; placeholder?: string; multiline?: boolean; maxLength?: number;
  keyboardType?: 'default' | 'numbers-and-punctuation'; autoCapitalize?: 'none' | 'sentences';
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: BOLD, fontSize: 14, color: colors.ink }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSoft}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        accessibilityLabel={label}
        style={{
          minHeight: multiline ? 96 : 48, borderRadius: 12, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white,
          paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink, textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}

// A row of choices that scrolls sideways only inside itself.
export function ChoiceChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: on ? colors.ink : colors.fieldLine, backgroundColor: on ? colors.ink : colors.white }}
    >
      <Text style={{ fontFamily: BOLD, fontSize: 14, color: on ? colors.sand : colors.ink }}>{label}</Text>
    </Pressable>
  );
}
