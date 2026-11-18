import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ScrollView } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { Wordmark } from '@/components/Brand';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import PhotoPlaceholder from '@/components/PhotoPlaceholder';
import Icon, { type IconName } from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { useRequireAccount } from '@/lib/requireAccount';
import { formatAed, GENDER_POLICY_LABEL, setResidenceSaved } from '@/lib/housing';
import { LISTING_TYPE_LABEL } from '@/lib/listing';
import { formatAedAmount } from '@/lib/rentSplit';
import AnimatedPressable from '@/components/AnimatedPressable';
import BurstHeart from '@/components/BurstHeart';
import Skeleton from '@/components/Skeleton';
import { BillsTag, DealTag, StateBlock, VerifiedBadge } from '@/components/housing/parts';
import { setCompareOwner, useCompareIds } from '@/components/housing/compareStore';
import { takePendingReturn } from '@/components/housing/pendingReturn';
import {
  EMPTY_FILTERS, PRICE_CAPS, SORT_LABEL, billsLine, commuteText, eachPersonLine, filterAndSort, filtersActive, housematesLine,
  isDeal, isWholeHome, pickCommute, priceInfo, type Filters, type SortChoice,
} from '@/components/housing/listingModel';
import type { ColorTokens } from '@/theme/tokens';
import type { ListingType, Residence } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const KINDS: ListingType[] = ['residence', 'shared_room', 'private_room', 'studio'];
const SORTS: SortChoice[] = ['recommended', 'price_low', 'price_high', 'newest'];

export default function HousingScreen() {
  const navigation = useNavigation<Nav>();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const requireAccount = useRequireAccount();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;
  const myUniversity = profile?.university ?? null;
  const compareIds = useCompareIds();

  const [residences, setResidences] = useState<Residence[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [savedOnly, setSavedOnly] = useState(false);
  const [sort, setSort] = useState<SortChoice>('recommended');
  const [sortOpen, setSortOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [residenceRes, savedRes] = await Promise.all([
        supabase.from('residences').select('*, room_types(*)').eq('is_active', true).order('created_at', { ascending: false }),
        myId ? supabase.from('saved_residences').select('residence_id').eq('user_id', myId) : Promise.resolve({ data: [], error: null }),
      ]);
      if (residenceRes.error) throw residenceRes.error;
      setResidences((residenceRes.data as Residence[]) ?? []);
      setSavedIds(new Set(((savedRes.data as { residence_id: string }[]) ?? []).map((r) => r.residence_id)));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
    setLoaded(true);
  }, [myId]);

  // The compare list belongs to whoever is signed in: start empty for a visitor.
  React.useEffect(() => { setCompareOwner(myId ?? null); }, [myId]);

  useFocusEffect(useCallback(() => {
    load();
    // Someone who made an account from a listing lands back on that listing.
    if (myId) {
      const back = takePendingReturn();
      if (back) navigation.navigate('ResidenceDetail', { residenceId: back });
    }
  }, [load, myId, navigation]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggleSaved = async (residence: Residence) => {
    if (!requireAccount('save', residence.id)) return;
    if (!myId) return;
    const willSave = !savedIds.has(residence.id);
    haptics.tap();
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (willSave) next.add(residence.id); else next.delete(residence.id);
      return next;
    });
    try {
      await setResidenceSaved(myId, residence.id, willSave);
    } catch {
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (willSave) next.delete(residence.id); else next.add(residence.id);
        return next;
      });
      showToast('Couldn’t update your saved list. Try again.', 'error');
    }
  };

  const visible = useMemo(() => {
    const list = filterAndSort(residences, filters, sort);
    return savedOnly ? list.filter((r) => savedIds.has(r.id)) : list;
  }, [residences, filters, sort, savedOnly, savedIds]);

  const anyFilter = filtersActive(filters) || savedOnly;
  const clearAll = () => { setFilters(EMPTY_FILTERS); setSavedOnly(false); };
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  const chip = (key: string, label: string, selected: boolean, onPress: () => void, icon?: IconName) => (
    <AnimatedPressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={() => { haptics.tap(); onPress(); }}
    >
      {icon && <Icon name={icon} size={15} color={selected ? '#FFFFFF' : colors.ink} />}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </AnimatedPressable>
  );

  const openCompare = () => {
    if (!requireAccount('compare')) return;
    navigation.navigate('Compare');
  };

  const header = (
    <View>
      <View style={styles.topRow}>
        <Wordmark size={26} />
        <View style={styles.topActions}>
          {myId ? (
            <AnimatedPressable style={styles.iconBtn} onPress={() => navigation.navigate('MyEnquiries')} accessibilityRole="button" accessibilityLabel="My enquiries">
              <Icon name="clipboard" size={18} color={colors.ink} />
            </AnimatedPressable>
          ) : (
            <AnimatedPressable style={styles.loginBtn} onPress={() => navigation.navigate('Login')} accessibilityRole="button" accessibilityLabel="Log in">
              <Text style={styles.loginText}>Log in</Text>
            </AnimatedPressable>
          )}
        </View>
      </View>
      <Text style={styles.title}>Find a place near your campus</Text>

      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.inkSoft} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search a university or an area"
          placeholderTextColor="#6B655A"
          value={filters.query}
          onChangeText={(query) => set({ query })}
          accessibilityLabel="Search a university or an area"
          returnKeyType="search"
          maxLength={80}
        />
        {filters.query ? (
          <AnimatedPressable onPress={() => set({ query: '' })} accessibilityRole="button" accessibilityLabel="Clear search" style={styles.clearBtn}>
            <Icon name="x" size={16} color={colors.inkSoft} />
          </AnimatedPressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.chipScroller}>
        {chip('verified', 'Verified by Havenly', filters.verified, () => set({ verified: !filters.verified }), 'shield-check')}
        {PRICE_CAPS.map((cap) => chip(`cap${cap}`, `Up to ${formatAedAmount(cap)}`, filters.maxMonthly === cap, () => set({ maxMonthly: filters.maxMonthly === cap ? null : cap })))}
        {chip('bills', 'Bills included', filters.billsIncluded, () => set({ billsIncluded: !filters.billsIncluded }), 'zap')}
        {chip('deal', 'Student deal', filters.studentDeal, () => set({ studentDeal: !filters.studentDeal }))}
        {KINDS.map((k) => chip(k, LISTING_TYPE_LABEL[k], filters.kind === k && filters.bedrooms == null, () => set({ kind: filters.kind === k && filters.bedrooms == null ? null : k, bedrooms: null })))}
        {([1, 2, 3] as const).map((b) => chip(`bed${b}`, `${b} bedroom home`, filters.kind === 'home' && filters.bedrooms === b, () => (
          filters.kind === 'home' && filters.bedrooms === b ? set({ kind: null, bedrooms: null }) : set({ kind: 'home', bedrooms: b })
        )))}
        {(['mixed', 'female_only', 'male_only'] as const).map((g) => chip(g, GENDER_POLICY_LABEL[g], filters.gender === g, () => set({ gender: filters.gender === g ? null : g })))}
        {myId ? chip('saved', 'Saved', savedOnly, () => setSavedOnly((v) => !v), 'heart') : null}
      </ScrollView>

      {loaded && !loadFailed ? (
        <View style={styles.countRow}>
          <Text style={styles.count} accessibilityRole="header">
            {visible.length === 1 ? '1 place' : `${visible.length} places`}{filters.query.trim() ? ` for “${filters.query.trim()}”` : ''}
          </Text>
          <AnimatedPressable style={styles.sortBtn} onPress={() => setSortOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={`Sort: ${SORT_LABEL[sort]}`}>
            <Text style={styles.sortText}>{SORT_LABEL[sort]}</Text>
            <Icon name="filter" size={14} color={colors.ink} />
          </AnimatedPressable>
        </View>
      ) : null}
      {sortOpen ? (
        <View style={styles.sortMenu}>
          {SORTS.map((s) => (
            <AnimatedPressable key={s} style={styles.sortItem} onPress={() => { setSort(s); setSortOpen(false); }} accessibilityRole="button" accessibilityState={{ selected: sort === s }}>
              <Text style={[styles.sortItemText, sort === s && { fontFamily: 'HankenGrotesk_700Bold' }]}>{SORT_LABEL[s]}</Text>
              {sort === s ? <Icon name="check" size={16} color={colors.coral} /> : null}
            </AnimatedPressable>
          ))}
        </View>
      ) : null}
    </View>
  );

  const renderCard = ({ item }: { item: Residence }) => {
    const { now, was } = priceInfo(item);
    const isSaved = savedIds.has(item.id);
    const commute = pickCommute(item, myUniversity);
    const each = eachPersonLine(item);
    const home = isWholeHome(item);
    const housemates = housematesLine(item.housemates);
    const kindLabel = `${item.listing_type === 'home' && item.bedrooms ? `Whole ${item.bedrooms} bedroom home` : LISTING_TYPE_LABEL[item.listing_type]} in ${item.area}`;
    return (
      <AnimatedPressable
        style={styles.card}
        scaleTo={0.99}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${kindLabel}${now != null ? `, ${formatAed(now)} per month` : ''}`}
        onPress={() => navigation.navigate('ResidenceDetail', { residenceId: item.id })}
      >
        <View style={styles.photoWrap}>
          {item.photo_urls[0] ? (
            <Image source={{ uri: item.photo_urls[0] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityLabel={`Photo of ${item.name}`} />
          ) : (
            <PhotoPlaceholder icon="home" style={StyleSheet.absoluteFill} />
          )}
          <AnimatedPressable style={styles.saveBtn} scaleTo={0.92} onPress={() => toggleSaved(item)} accessibilityRole="button" accessibilityLabel={isSaved ? 'Remove from saved' : 'Save this place'}>
            <BurstHeart active={isSaved} size={20} color="#1F1B16" activeColor="#7A2433" />
          </AnimatedPressable>
          <View style={styles.photoBottom}>
            <View>{item.is_verified ? <VerifiedBadge /> : isDeal(item) ? <DealTag /> : null}</View>
            {item.photo_urls.length > 0 ? (
              <View style={styles.countPill}><Text style={styles.countPillText}>1 / {item.photo_urls.length}</Text></View>
            ) : null}
          </View>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.priceRow}>
            <View style={styles.priceLine}>
              {now != null ? <Text style={styles.price}>{formatAed(now)}</Text> : <Text style={styles.priceMissing}>Price on request</Text>}
              {was != null ? <Text style={styles.was}>{formatAed(was)}</Text> : null}
              {now != null ? <Text style={styles.per}>{home ? 'per month for the whole home' : 'per month'}</Text> : null}
            </View>
            {item.bills_included === true ? <BillsTag /> : null}
          </View>
          {each ? <Text style={styles.each}>{each}</Text> : null}
          {item.bills_included !== true ? <Text style={styles.bills}>{billsLine(item)}</Text> : null}
          <Text style={styles.kind}>{item.name}</Text>
          <Text style={styles.kindSub}>{kindLabel}</Text>
          {commute ? (
            <View style={styles.metaRow}>
              <Icon name="bus" size={16} color={colors.inkSoft} />
              <Text style={styles.meta}>{commuteText(commute)} to {commute.university}</Text>
            </View>
          ) : null}
          {housemates ? (
            <View style={styles.metaRow}>
              <Icon name="users" size={16} color={colors.inkSoft} />
              <Text style={styles.meta}>{housemates}</Text>
            </View>
          ) : null}
        </View>
      </AnimatedPressable>
    );
  };

  let empty: React.ReactNode;
  if (!loaded) {
    empty = (
      <View style={{ marginTop: 12 }} accessibilityLabel="Loading places">
        {[0, 1].map((i) => (
          <View key={i} style={styles.card}>
            <Skeleton style={{ height: 188, borderRadius: 0 }} />
            <View style={{ padding: 14, gap: 10 }}>
              <Skeleton style={{ height: 24, width: '45%' }} />
              <Skeleton style={{ height: 16, width: '70%' }} />
              <Skeleton style={{ height: 14, width: '55%' }} />
            </View>
          </View>
        ))}
      </View>
    );
  } else if (loadFailed) {
    empty = (
      <StateBlock
        icon="alert-circle" kind="error" title="We could not load the places"
        body="Check your connection and try again. Nothing you saved has been lost."
        primary={{ label: 'Try again', onPress: () => { setLoaded(false); load(); } }}
      />
    );
  } else if (anyFilter) {
    empty = (
      <StateBlock
        icon="filter" title="No places match these filters"
        body={`Try a higher budget or take a filter off. ${residences.length} ${residences.length === 1 ? 'place is' : 'places are'} listed in all.`}
        primary={{ label: 'Clear filters', onPress: clearAll }}
      />
    );
  } else {
    empty = <StateBlock icon="home" title="No places listed yet" body="We are adding places near the main campuses. Check back soon." />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={loaded && !loadFailed ? visible : []}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 150, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
      />
      {compareIds.length > 0 ? (
        <AnimatedPressable style={styles.compareBar} onPress={openCompare} accessibilityRole="button" accessibilityLabel={`Compare ${compareIds.length} ${compareIds.length === 1 ? "place" : "places"}`}>
          <Icon name="grid" size={18} color="#FFFFFF" />
          <Text style={styles.compareText}>Compare {compareIds.length} {compareIds.length === 1 ? 'place' : 'places'}</Text>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 52, minHeight: 96 },
    wordmark: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 26, letterSpacing: -0.5, color: colors.ink },
    topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    loginBtn: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    loginText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 15, color: colors.ink },
    iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 30, lineHeight: 33, letterSpacing: -0.6, color: colors.ink, paddingHorizontal: 16, marginTop: 4 },
    search: {
      flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 16, height: 52, paddingHorizontal: 14,
      borderRadius: 12, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white,
    },
    searchInput: { flex: 1, fontSize: 16, color: colors.ink, height: 50, outlineStyle: 'none' } as never,
    clearBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
    chipScroller: { flexGrow: 0, marginTop: 12 },
    chipRow: { gap: 8, paddingHorizontal: 16 },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 100,
      borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white,
    },
    chipSelected: { backgroundColor: colors.coral, borderColor: colors.coral },
    chipText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink },
    chipTextSelected: { color: '#FFFFFF' },
    countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, marginTop: 12, minHeight: 44 },
    count: { flex: 1, fontSize: 14, color: colors.inkSoft },
    sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, justifyContent: 'center' },
    sortText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink, textDecorationLine: 'underline' },
    sortMenu: { marginHorizontal: 16, backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.line },
    sortItem: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
    sortItemText: { fontSize: 15, color: colors.ink },
    card: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', marginBottom: 16, marginHorizontal: 16 },
    photoWrap: { height: 188, backgroundColor: '#DDD7CB' },
    saveBtn: { position: 'absolute', top: 10, right: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    photoBottom: { position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
    countPill: { backgroundColor: '#1F1B16', paddingHorizontal: 10, minHeight: 28, borderRadius: 8, justifyContent: 'center' },
    countPillText: { color: '#FFFFFF', fontFamily: 'HankenGrotesk_700Bold', fontSize: 13 },
    cardBody: { padding: 14, gap: 4 },
    priceRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
    priceLine: { flex: 1, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 },
    price: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 24, color: colors.ink },
    priceMissing: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 20, color: colors.ink },
    was: { fontSize: 14, color: colors.inkSoft, textDecorationLine: 'line-through' },
    per: { fontSize: 14, color: colors.inkSoft },
    each: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, color: colors.tintText },
    bills: { fontSize: 14, color: colors.inkBody },
    kind: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 18, lineHeight: 23, color: colors.ink, marginTop: 4 },
    kindSub: { fontSize: 14, color: colors.inkBody },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    meta: { flex: 1, fontSize: 14, color: colors.inkBody },
    compareBar: {
      position: 'absolute', left: 16, right: 16, bottom: 84, height: 52, borderRadius: 12, backgroundColor: colors.coral,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    compareText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 16, color: '#FFFFFF' },
  });
}
