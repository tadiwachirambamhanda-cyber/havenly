import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '@/components/Text';
import Icon from '@/components/Icon';
import { PrimaryButton } from '@/components/housing/parts';
import { useTheme } from '@/lib/ThemeContext';
import { LIFESTYLE_LABEL, NOTE_MAX, budgetLine, genderLabel, type BoardCard } from '@/lib/housemates';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { Avatar, BOLD, GUTTER } from './ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// One housemate card, used by the board and by a university community's Housemates section (F21).
export default function HousemateCardView({ card, busy, onMessage, onReport, onBlock }: {
  card: BoardCard; busy: boolean; onMessage: () => void; onReport: () => void; onBlock: () => void;
}) {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const s = useMemo(() => styles(colors), [colors]);
  const gender = genderLabel(card.gender);
  const first = card.display_name.split(/\s+/)[0] || card.display_name;
  return (
    <View style={s.card}>
      <View style={s.head}>
        <Avatar name={card.display_name} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.name} numberOfLines={1}>{card.display_name}</Text>
          <Text style={s.meta} numberOfLines={1}>{[gender, card.university].filter(Boolean).join(' · ')}</Text>
        </View>
      </View>
      <Text style={s.budget}>{budgetLine(card)}</Text>
      {card.area ? <Text style={s.meta}>Wants to live in {card.area}</Text> : null}
      {card.residence_id && card.residence_name ? (
        <Pressable onPress={() => navigation.navigate('ResidenceDetail', { residenceId: card.residence_id! })} accessibilityRole="button" style={s.homeRow}>
          <Icon name="home" size={14} color={colors.mintText} />
          <Text style={s.homeText} numberOfLines={2}>
            {card.spots_needed ? `Needs ${card.spots_needed} more for ` : 'Looking at '}{card.residence_name}
          </Text>
        </Pressable>
      ) : null}
      {card.lifestyle.length > 0 ? (
        <View style={s.tags}>
          {card.lifestyle.map((k, i) => <View key={`${k}-${i}`} style={s.tag}><Text style={s.tagText}>{LIFESTYLE_LABEL[k]}</Text></View>)}
        </View>
      ) : null}
      {card.note ? <Text style={s.note}>{card.note.slice(0, NOTE_MAX)}</Text> : null}
      <PrimaryButton label={`Message ${first}`} icon="message-circle" onPress={onMessage} loading={busy} height={48} style={{ marginTop: 12, borderRadius: 24 }} />
      <View style={s.safetyRow}>
        <Pressable onPress={onReport} accessibilityRole="button" accessibilityLabel={`Report ${card.display_name}`} hitSlop={10} style={s.safetyBtn}><Text style={s.safetyLink}>Report</Text></Pressable>
        <Pressable onPress={onBlock} accessibilityRole="button" accessibilityLabel={`Block ${card.display_name}`} hitSlop={10} style={s.safetyBtn}><Text style={s.safetyLink}>Block</Text></Pressable>
      </View>
    </View>
  );
}

function styles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line, marginHorizontal: GUTTER, marginBottom: 12, padding: 16, gap: 6 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
    name: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 18, color: colors.ink },
    meta: { fontSize: 13.5, color: colors.inkSoft },
    budget: { fontFamily: BOLD, fontSize: 15, color: colors.ink },
    homeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.mintBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginTop: 2, minHeight: 44 },
    homeText: { flex: 1, fontSize: 13.5, fontFamily: BOLD, color: colors.mintText },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
    tag: { backgroundColor: colors.tintBg, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
    tagText: { fontSize: 12.5, fontFamily: BOLD, color: colors.tintText },
    note: { fontSize: 14, lineHeight: 20, color: colors.inkBody, marginTop: 4 },
    safetyRow: { flexDirection: 'row', justifyContent: 'center', gap: 28, marginTop: 6 },
    safetyBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
    safetyLink: { fontSize: 13, color: colors.inkSoft, textDecorationLine: 'underline' },
  });
}
