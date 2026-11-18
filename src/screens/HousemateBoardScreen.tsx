import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Pressable, ScrollView } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import BackButton from '@/components/BackButton';
import InitialsAvatar from '@/components/InitialsAvatar';
import ReportModal from '@/components/ReportModal';
import ActionSheet from '@/components/ActionSheet';
import Skeleton from '@/components/Skeleton';
import { OutlineButton, PrimaryButton, StateBlock } from '@/components/housing/parts';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { findOrCreateConversation } from '@/lib/conversations';
import { blockUser, submitReport } from '@/lib/safety';
import { fetchBoard } from '@/lib/housematesApi';
import { LIFESTYLE_LABEL, NOTE_MAX, budgetLine, genderLabel, type BoardCard } from '@/lib/housemates';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'HousemateBoard'>;

export default function HousemateBoardScreen() {
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<BoardCard | null>(null);
  const [blockTarget, setBlockTarget] = useState<BoardCard | null>(null);

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

  const sayHi = async (card: BoardCard) => {
    if (!myId) return;
    haptics.tap();
    setBusyId(card.user_id);
    try {
      const conversationId = await findOrCreateConversation(myId, card.user_id);
      navigation.navigate('Chat', { conversationId, otherUserId: card.user_id });
    } catch (e) {
      showToast(e instanceof Error && e.message ? e.message : 'Couldn’t start the conversation. Try again.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmBlock = async () => {
    const target = blockTarget;
    if (!target || !myId) return;
    try {
      await blockUser(myId, target.user_id);
      setData((prev) => (prev ? { ...prev, cards: prev.cards.filter((c) => c.user_id !== target.user_id) } : prev));
      showToast('Blocked. You will not see each other any more.');
    } catch {
      showToast('Couldn’t block. Try again.', 'error');
    }
  };

  const submitCardReport = async (reason: string) => {
    const target = reportTarget;
    setReportTarget(null);
    if (!target || !myId) return;
    try {
      await submitReport(myId, 'user', target.user_id, reason);
      showToast('Thanks. The team will look at this.');
    } catch {
      showToast('Couldn’t send the report. Try again.', 'error');
    }
  };

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

  const renderCard = ({ item }: { item: BoardCard }) => {
    const gender = genderLabel(item.gender);
    return (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <InitialsAvatar name={item.display_name} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{item.display_name}</Text>
            <Text style={styles.meta} numberOfLines={1}>{[gender, item.university].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>
        <Text style={styles.budget}>{budgetLine(item)}</Text>
        {item.area ? <Text style={styles.meta}>Wants to live in {item.area}</Text> : null}
        {item.residence_id && item.residence_name ? (
          <Pressable onPress={() => navigation.navigate('ResidenceDetail', { residenceId: item.residence_id! })} accessibilityRole="button" style={styles.homeRow}>
            <Icon name="home" size={14} color={colors.tintText} />
            <Text style={styles.homeText} numberOfLines={2}>
              {item.spots_needed ? `Needs ${item.spots_needed} more for ` : 'Looking at '}{item.residence_name}
            </Text>
          </Pressable>
        ) : null}
        {item.lifestyle.length > 0 ? (
          <View style={styles.tags}>
            {item.lifestyle.map((k) => <View key={k} style={styles.tag}><Text style={styles.tagText}>{LIFESTYLE_LABEL[k]}</Text></View>)}
          </View>
        ) : null}
        {item.note ? <Text style={styles.note}>{item.note.slice(0, NOTE_MAX)}</Text> : null}
        <PrimaryButton label="Say hi" icon="message-circle" onPress={() => sayHi(item)} loading={busyId === item.user_id} height={48} style={{ marginTop: 12 }} />
        <View style={styles.safetyRow}>
          <Pressable onPress={() => setReportTarget(item)} accessibilityRole="button" accessibilityLabel={`Report ${item.display_name}`} hitSlop={8}><Text style={styles.safetyLink}>Report</Text></Pressable>
          <Pressable onPress={() => setBlockTarget(item)} accessibilityRole="button" accessibilityLabel={`Block ${item.display_name}`} hitSlop={8}><Text style={styles.safetyLink}>Block</Text></Pressable>
        </View>
      </View>
    );
  };

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
      <ReportModal visible={!!reportTarget} onClose={() => setReportTarget(null)} onSubmit={submitCardReport} />
      <ActionSheet
        visible={!!blockTarget}
        onClose={() => setBlockTarget(null)}
        title={`Block ${blockTarget?.display_name ?? 'this student'}?`}
        message="You will not see each other's cards, and they cannot message you."
        actions={[{ label: 'Block', destructive: true, onPress: confirmBlock }]}
      />
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
    card: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, marginHorizontal: spacing.lg, marginBottom: 14, padding: 16, gap: 6 },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    name: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 18, color: colors.ink },
    meta: { fontSize: 13.5, color: colors.inkSoft },
    budget: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 15, color: colors.ink },
    homeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.tintBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 2 },
    homeText: { flex: 1, fontSize: 13.5, fontWeight: '600', color: colors.tintText },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
    tag: { backgroundColor: colors.sandDeep, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
    tagText: { fontSize: 12.5, fontWeight: '600', color: colors.inkBody },
    note: { fontSize: 14, lineHeight: 20, color: colors.inkBody, marginTop: 4 },
    safetyRow: { flexDirection: 'row', justifyContent: 'center', gap: 28, marginTop: 10 },
    safetyLink: { fontSize: 13, color: colors.inkSoft, textDecorationLine: 'underline', minHeight: 24 },
  });
}
