import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import Icon from '@/components/Icon';
import { StateBlock } from '@/components/housing/parts';
import { CodeBox, GetCodeButton, usePerkCodes } from '@/components/community/PerkCard';
import { BOLD, CardSkeletons, Content, GUTTER, ScreenTop, TITLE_FONT } from '@/components/community/ui';
import { useTheme } from '@/lib/ThemeContext';
import { eventWhen, isUpcoming } from '@/lib/community';
import { fetchPerk, type PerkRow } from '@/lib/communityApi';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'PerkDetail'>;

// One perk (F23) with my personal code in a dashed box.
export default function PerkDetailScreen() {
  const { perkId } = useRoute<Route>().params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useMemo(() => styles(colors), [colors]);
  const [perk, setPerk] = useState<PerkRow | null | undefined | 'failed'>(undefined);
  const codes = usePerkCodes();

  const load = useCallback(async () => {
    try { setPerk(await fetchPerk(perkId)); } catch { setPerk('failed'); }
  }, [perkId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const live = perk && perk !== 'failed' && perk.is_active && perk.brand.is_active && (!perk.ends_at || isUpcoming(perk.ends_at));
  const code = perk && perk !== 'failed' ? codes.codes[perk.id] : undefined;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 40 }}>
      <Content>
        <ScreenTop title="Perk" />
        {perk === undefined ? <CardSkeletons count={1} height={220} /> : perk === 'failed' ? (
          <StateBlock icon="alert-circle" kind="error" title="We could not load this perk" body="Check your connection and try again."
            primary={{ label: 'Try again', onPress: () => { setPerk(undefined); load(); } }} />
        ) : perk === null ? (
          <StateBlock icon="gift" title="This perk is no longer available" body="It may have ended." />
        ) : (
          <View style={s.card}>
            <Text style={s.kicker}>STUDENT PERK · {perk.brand.name.toUpperCase()}</Text>
            <Text style={s.title} accessibilityRole="header">{perk.discount_label}</Text>
            <Text style={s.sub}>{perk.title}</Text>
            {perk.description ? <Text style={s.body}>{perk.description}</Text> : null}
            {perk.address ? <View style={s.line}><Icon name="map-pin" size={16} color={colors.dealText} /><Text style={s.lineText}>{perk.address}</Text></View> : null}
            {perk.ends_at ? <View style={s.line}><Icon name="calendar" size={16} color={colors.dealText} /><Text style={s.lineText}>Ends {eventWhen(perk.ends_at).replace(/, .*$/, '')}</Text></View> : null}
            {code ? <CodeBox code={code} /> : live ? (
              <View style={{ marginTop: 12 }}>
                <GetCodeButton loading={codes.busy === perk.id} shown={false} onPress={() => codes.getCode(perk.id)} />
              </View>
            ) : <Text style={s.body}>This perk has ended.</Text>}
            <Text style={s.note}>Show your code at the counter. One code per student; tapping again shows the same code.</Text>
          </View>
        )}
      </Content>
    </ScrollView>
  );
}

function styles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    card: { backgroundColor: colors.dealBg, borderRadius: 22, padding: 18, marginHorizontal: GUTTER, gap: 6 },
    kicker: { fontFamily: BOLD, fontSize: 12, letterSpacing: 0.6, color: colors.dealText },
    title: { fontFamily: TITLE_FONT, fontSize: 27, letterSpacing: -0.6, color: colors.dealText },
    sub: { fontFamily: BOLD, fontSize: 16, color: colors.dealText },
    body: { fontSize: 15, lineHeight: 21, color: colors.dealText },
    line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    lineText: { flex: 1, fontSize: 14, color: colors.dealText },
    note: { fontSize: 12.5, lineHeight: 18, color: colors.dealText, marginTop: 10 },
  });
}
