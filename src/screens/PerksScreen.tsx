import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { StateBlock } from '@/components/housing/parts';
import PerkCard, { usePerkCodes } from '@/components/community/PerkCard';
import { CardSkeletons, Content, GUTTER, ScreenTop } from '@/components/community/ui';
import { useTheme } from '@/lib/ThemeContext';
import { fetchPerks, type PerkRow } from '@/lib/communityApi';
import type { ColorTokens } from '@/theme/tokens';

// Student perks (F23): active perks in the sun colour, each with "Get code" (the same personal code every time).
export default function PerksScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useMemo(() => styles(colors), [colors]);
  const [perks, setPerks] = useState<PerkRow[] | null | 'failed'>(null);
  const [refreshing, setRefreshing] = useState(false);
  const codes = usePerkCodes();

  const load = useCallback(async () => {
    try { setPerks(await fetchPerks()); } catch { setPerks('failed'); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  let empty: React.ReactNode = null;
  if (perks === null) empty = <CardSkeletons count={3} height={120} />;
  else if (perks === 'failed') empty = <StateBlock icon="alert-circle" kind="error" title="We could not load perks" body="Check your connection and try again." primary={{ label: 'Try again', onPress: () => { setPerks(null); load(); } }} />;
  else if (!perks.length) empty = <StateBlock icon="gift" title="No perks right now" body="Student discounts from brands near campus show up here." />;

  return (
    <View style={s.container}>
      <FlatList
        data={Array.isArray(perks) ? perks : []}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={
          <Content style={{ paddingTop: insets.top + 10 }}>
            <ScreenTop title="Perks" />
            <Text style={s.intro}>Show your code at the counter. One code per student for each perk.</Text>
          </Content>
        }
        ListEmptyComponent={empty ? <Content>{empty}</Content> : undefined}
        renderItem={({ item }) => (
          <Content>
            <PerkCard perk={item} code={codes.codes[item.id]} loading={codes.busy === item.id} onGetCode={() => codes.getCode(item.id)} />
          </Content>
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
      />
    </View>
  );
}

function styles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    intro: { fontSize: 14, lineHeight: 20, color: colors.inkSoft, paddingHorizontal: GUTTER, marginBottom: 14 },
  });
}
