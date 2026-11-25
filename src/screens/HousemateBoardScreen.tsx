import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Pressable, ScrollView } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import BackButton from '@/components/BackButton';
import Skeleton from '@/components/Skeleton';
import { OutlineButton, StateBlock } from '@/components/housing/parts';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { fetchBoard } from '@/lib/housematesApi';
import type { BoardCard } from '@/lib/housemates';
import HousemateCardView from '@/components/community/HousemateCardView';
import { useHousemateActions } from '@/components/community/useHousemateActions';
import { Content } from '@/components/community/ui';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'HousemateBoard'>;

// Keyed by the account, so open report and block prompts and the loaded list reset if the account ever changes.
export default function HousemateBoardScreen() {
  const { session } = useAuth();
  return <HousemateBoard key={session?.user.id ?? 'signed-out'} />;
}

function HousemateBoard() {
  const navigation = useNavigation<Nav>();
  const { residenceId } = useRoute<Route>().params ?? {};
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;
  const myUniversity = profile?.university ?? null;
  const myBudget = profile?.budget_aed ?? null;
  const myMoveIn = profile?.move_in_month ?? null;

  const [sameUniversity, setSameUniversity] = useState(false);
  const [withinBudget, setWithinBudget] = useState(false);
  const [myMonth, setMyMonth] = useState(false);
  const [area, setArea] = useState('');
  // The loaded list is tagged with the account it was loaded for, so a slow load for another account never shows.
  const [data, setData] = useState<{ owner: string | undefined; cards: BoardCard[]; failed: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const current = data && data.owner === myId ? data : null;
  const cards = current?.cards ?? [];

  const load = useCallback(async () => {
    try {
      const rows = await fetchBoard({
        university: sameUniversity ? myUniversity : null,
        maxBudget: withinBudget ? myBudget : null,
        moveIn: myMonth ? myMoveIn : null,
        area,
        residenceId: residenceId ?? null,
      });
      setData({ owner: myId, cards: rows, failed: false });
    } catch {
      setData({ owner: myId, cards: [], failed: true });
    }
  }, [sameUniversity, withinBudget, myMonth, area, residenceId, myUniversity, myBudget, myMoveIn, myId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const actions = useHousemateActions((userId) =>
    setData((prev) => (prev ? { ...prev, cards: prev.cards.filter((c) => c.user_id !== userId) } : prev)));

  const chip = (label: string, on: boolean, toggle: () => void, disabledReason?: string | null) => (
    <Pressable
      key={label}
      style={[styles.chip, on && styles.chipOn, disabledReason ? styles.chipDisabled : null]}
      onPress={() => (disabledReason ? showToast(disabledReason) : toggle())}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );

  const header = (
    <View>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <BackButton style={styles.back}><Icon name="arrow-left" size={17} color={colors.ink} /></BackButton>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} accessibilityRole="header">Housemates</Text>
          <Text style={styles.sub}>{residenceId ? 'Students looking for housemates for this home' : 'Students who want to live together'}</Text>
        </View>
        <OutlineButton label="My card" onPress={() => navigation.navigate('MyHousemateCard', residenceId ? { residenceId } : undefined)} height={44} />
      </View>
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.inkSoft} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search an area, for example Marina"
          placeholderTextColor="#6B655A"
          value={area}
          onChangeText={setArea}
          returnKeyType="search"
          maxLength={80}
          accessibilityLabel="Search an area"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {chip('My university', sameUniversity, () => setSameUniversity((v) => !v), myUniversity ? null : 'Add your university in Edit profile first.')}
        {chip('Within my budget', withinBudget, () => setWithinBudget((v) => !v), myBudget != null ? null : 'Add your budget in Edit profile first.')}
        {chip('My move-in month', myMonth, () => setMyMonth((v) => !v), myMoveIn ? null : 'Add your move-in month in Edit profile first.')}
      </ScrollView>
      <Text style={styles.count}>{current ? (cards.length === 1 ? '1 student' : `${cards.length} students`) : ' '}</Text>
    </View>
  );

  const renderCard = ({ item }: { item: BoardCard }) => (
    <Content>
      <HousemateCardView
        card={item}
        busy={actions.busyId === item.user_id}
        onMessage={() => actions.message(item)}
        onReport={() => actions.report(item)}
        onBlock={() => actions.block(item)}
      />
    </Content>
  );

  let empty: React.ReactNode = null;
  if (!current) {
    empty = (
      <View accessibilityLabel="Loading housemates">
        {[0, 1].map((i) => <Skeleton key={i} style={{ height: 190, marginHorizontal: 16, marginBottom: 12, borderRadius: 14 }} />)}
      </View>
    );
  } else if (current.failed) {
    empty = <StateBlock icon="alert-circle" kind="error" title="We could not load the board" body="Check your connection and try again."
      primary={{ label: 'Try again', onPress: () => { setData(null); load(); } }} />;
  } else if (cards.length === 0) {
    empty = <StateBlock icon="users" title="No one here yet" body="New cards appear after the team has checked them. Make your own card so others can find you."
      primary={{ label: 'Make my card', onPress: () => navigation.navigate('MyHousemateCard', residenceId ? { residenceId } : undefined) }} />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={cards}
        keyExtractor={(c) => c.user_id}
        renderItem={renderCard}
        ListHeaderComponent={header}
        ListEmptyComponent={empty ? <View>{empty}</View> : undefined}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
        keyboardShouldPersistTaps="handled"
      />
      {actions.element}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingBottom: 12 },
    back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 26, letterSpacing: -0.5, color: colors.ink },
    sub: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.lg, height: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white, paddingHorizontal: 14 },
    searchInput: { flex: 1, fontSize: 16, color: colors.ink },
    chipRow: { gap: 8, paddingHorizontal: spacing.lg, paddingVertical: 12 },
    chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white },
    chipOn: { backgroundColor: colors.coralFill, borderColor: colors.coralFill },
    chipDisabled: { opacity: 0.6 },
    chipText: { fontSize: 14, fontWeight: '600', color: colors.ink },
    chipTextOn: { color: '#FFFFFF' },
    count: { fontSize: 13, color: colors.inkSoft, paddingHorizontal: spacing.lg, marginBottom: 10 },
  });
}
