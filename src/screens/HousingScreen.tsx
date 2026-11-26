import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ScrollView, Pressable } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { RoofH, Wordmark } from '@/components/Brand';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import PhotoPlaceholder from '@/components/PhotoPlaceholder';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { useRequireAccount } from '@/lib/requireAccount';
import { formatAed, setResidenceSaved } from '@/lib/housing';
import { LISTING_TYPE_LABEL } from '@/lib/listing';
import AnimatedPressable from '@/components/AnimatedPressable';
import BurstHeart from '@/components/BurstHeart';
import Skeleton from '@/components/Skeleton';
import { BillsTag, CARD_RADIUS, DealTag, FIELD_RADIUS, SampleTag, StateBlock, TextButton, VerifiedBadge } from '@/components/housing/parts';
import { takePendingReturn } from '@/components/housing/pendingReturn';
import {
  EMPTY_FILTERS, PRICE_CAPS, SORT_LABEL, WHO_LABEL, billsLine, commuteText, eachPersonLine, filterAndSort, filtersActive, isDeal,
  isWholeHome, moreFiltersCount, morePillLabel, pickCommute, priceInfo, pricePillLabel, whoPillLabel, type Filters, type SortChoice,
} from '@/components/housing/listingModel';
import type { ColorTokens } from '@/theme/tokens';
import type { GenderPolicy, ListingType, Residence } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Panel = 'price' | 'kind' | 'who' | 'more' | null;

const KINDS: ListingType[] = ['residence', 'shared_room', 'private_room', 'studio', 'home'];
const WHO: GenderPolicy[] = ['mixed', 'female_only', 'male_only'];
const BEDROOMS = [1, 2, 3] as const;
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

  const [residences, setResidences] = useState<Residence[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [panel, setPanel] = useState<Panel>(null);
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

  const visible = useMemo(() => filterAndSort(residences, filters, sort), [residences, filters, sort]);

  const anyFilter = filtersActive(filters);
  const clearAll = () => { setFilters(EMPTY_FILTERS); setPanel(null); };
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  // Picking a kind other than a whole home drops the bedroom count, which only applies to homes.
  const pickKind = (kind: ListingType | null) => set(kind === 'home' ? { kind } : { kind, bedrooms: null });
  // A bedroom count means a whole home.
  const pickBedrooms = (b: 1 | 2 | 3) => (filters.bedrooms === b ? set({ bedrooms: null }) : set({ bedrooms: b, kind: 'home' }));

  // Opens the Community tab, where students talk about areas.
  const openCommunity = () => navigation.navigate('MainTabs', { screen: 'Community' });

  const pill = (key: Exclude<Panel, null>, label: string, selected: boolean, caret: boolean) => {
    const open = panel === key;
    return (
      <AnimatedPressable
        key={key}
        accessibilityRole="button"
        accessibilityState={{ selected, expanded: open }}
        accessibilityLabel={label}
        style={[styles.chip, selected && styles.chipSelected, open && !selected && styles.chipOpen]}
        onPress={() => { haptics.tap(); setSortOpen(false); setPanel(open ? null : key); }}
      >
        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
        {caret ? (
          <Icon name="chevron-right" size={12} color={selected ? '#FFFFFF' : colors.ink} style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }} />
        ) : null}
      </AnimatedPressable>
    );
  };

  // An option inside a panel. `close` shuts the panel after a single choice.
  const option = (key: string, label: string, selected: boolean, onPress: () => void, close = false) => (
    <AnimatedPressable
      key={key}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.option, selected && styles.chipSelected]}
      onPress={() => { haptics.tap(); onPress(); if (close) setPanel(null); }}
    >
      {selected ? <Icon name="check" size={13} color="#FFFFFF" /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </AnimatedPressable>
  );

  let panelBody: React.ReactNode = null;
  if (panel === 'price') {
    panelBody = (
      <>
        <Text style={styles.panelTitle}>Price a month</Text>
        <View style={styles.optionWrap}>
          {option('any', 'Any price', filters.maxMonthly == null, () => set({ maxMonthly: null }), true)}
          {PRICE_CAPS.map((cap) => option(`cap${cap}`, pricePillLabel(cap), filters.maxMonthly === cap, () => set({ maxMonthly: cap }), true))}
        </View>
      </>
    );
  } else if (panel === 'kind') {
    panelBody = (
      <>
        <Text style={styles.panelTitle}>Kind of place</Text>
        <View style={styles.optionWrap}>
          {option('any', 'Any kind', filters.kind == null, () => pickKind(null), true)}
          {KINDS.map((k) => option(k, LISTING_TYPE_LABEL[k], filters.kind === k, () => pickKind(k), true))}
        </View>
      </>
    );
  } else if (panel === 'who') {
    panelBody = (
      <>
        <Text style={styles.panelTitle}>Who it’s for</Text>
        <View style={styles.optionWrap}>
          {option('any', 'Anyone', filters.gender == null, () => set({ gender: null }), true)}
          {WHO.map((g) => option(g, WHO_LABEL[g], filters.gender === g, () => set({ gender: g }), true))}
        </View>
      </>
    );
  } else if (panel === 'more') {
    panelBody = (
      <>
        <Text style={styles.panelTitle}>More filters</Text>
        <View style={styles.optionWrap}>
          {option('bills', 'Bills included', filters.billsIncluded, () => set({ billsIncluded: !filters.billsIncluded }))}
          {option('deal', 'Student deal', filters.studentDeal, () => set({ studentDeal: !filters.studentDeal }))}
          {option('verified', 'Verified by Havenly', filters.verified, () => set({ verified: !filters.verified }))}
        </View>
        <Text style={[styles.panelTitle, { marginTop: 14 }]}>Bedrooms (whole homes)</Text>
        <View style={styles.optionWrap}>
          {BEDROOMS.map((b) => option(`bed${b}`, `${b} bedroom${b === 1 ? '' : 's'}`, filters.bedrooms === b, () => pickBedrooms(b)))}
        </View>
        <View style={styles.panelFoot}>
          {moreFiltersCount(filters) ? (
            <TextButton label="Clear these" color={colors.ink} onPress={() => set({ billsIncluded: false, studentDeal: false, verified: false, bedrooms: null })} />
          ) : <View />}
          <TextButton label="Done" onPress={() => setPanel(null)} />
        </View>
      </>
    );
  }

  const header = (
    <View>
      <View style={styles.topRow}>
        <View style={styles.brand}>
          <RoofH size={26} />
          <Wordmark size={24} />
        </View>
        <View style={styles.topActions}>
          {myId ? (
            <>
              {/* Saved is a stack screen in the three-tab app, opened from here and from Profile. */}
              <AnimatedPressable style={styles.iconBtn} onPress={() => navigation.navigate('Saved')} accessibilityRole="button" accessibilityLabel="Saved places">
                <Icon name="heart" size={18} color={colors.ink} />
              </AnimatedPressable>
              <AnimatedPressable style={styles.iconBtn} onPress={() => navigation.navigate('MyEnquiries')} accessibilityRole="button" accessibilityLabel="My enquiries">
                <Icon name="clipboard" size={18} color={colors.ink} />
              </AnimatedPressable>
            </>
          ) : (
            <AnimatedPressable style={styles.loginBtn} onPress={() => navigation.navigate('SignInToContinue', { reason: 'login' })} accessibilityRole="button" accessibilityLabel="Log in">
              <Text style={styles.loginText}>Log in</Text>
            </AnimatedPressable>
          )}
        </View>
      </View>
      <Text style={styles.title} accessibilityRole="header">Find your place near campus</Text>

      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.inkSoft} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search a university or an area"
          placeholderTextColor={colors.inkSoft}
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
        {pill('price', pricePillLabel(filters.maxMonthly), filters.maxMonthly != null, true)}
        {pill('kind', filters.kind ? LISTING_TYPE_LABEL[filters.kind] : 'Kind of place', filters.kind != null, true)}
        {pill('who', whoPillLabel(filters.gender), filters.gender != null, true)}
        {pill('more', morePillLabel(filters), moreFiltersCount(filters) > 0, false)}
      </ScrollView>

      {panelBody ? <View style={styles.panel}>{panelBody}</View> : null}

      {loaded && !loadFailed ? (
        <View style={styles.countRow}>
          <Text style={styles.count}>
            {visible.length === 1 ? '1 place' : `${visible.length} places`}{filters.query.trim() ? ` for “${filters.query.trim()}”` : ''}
          </Text>
          {anyFilter ? <TextButton label="Clear filters" color={colors.inkSoft} onPress={clearAll} style={{ marginRight: 12 }} /> : null}
          <AnimatedPressable style={styles.sortBtn} onPress={() => { setPanel(null); setSortOpen((o) => !o); }} accessibilityRole="button" accessibilityLabel={`Sort: ${SORT_LABEL[sort]}`}>
            <Text style={styles.sortText}>Sort: {SORT_LABEL[sort]}</Text>
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

  const banner = (area: string) => (
    <AnimatedPressable
      style={styles.banner}
      scaleTo={0.99}
      onPress={openCommunity}
      accessibilityRole="link"
      accessibilityLabel={`Not sure about an area? See what students say about ${area} in Community`}
    >
      <View style={styles.bannerIcon}><Icon name="message-circle" size={19} color={colors.mintText} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.bannerTitle}>Not sure about an area?</Text>
        <Text style={styles.bannerSub}>See what students say about {area}</Text>
      </View>
      <Icon name="chevron-right" size={16} color={colors.mintText} />
    </AnimatedPressable>
  );

  const renderCard = ({ item, index }: { item: Residence; index: number }) => {
    const { now, was } = priceInfo(item);
    const isSaved = savedIds.has(item.id);
    const commute = pickCommute(item, myUniversity);
    const each = eachPersonLine(item);
    const home = isWholeHome(item);
    const kindTitle = home && item.bedrooms ? `Whole ${item.bedrooms} bedroom home` : LISTING_TYPE_LABEL[item.listing_type];
    return (
      <>
        <AnimatedPressable
          style={styles.card}
          scaleTo={0.99}
          accessibilityRole="button"
          accessibilityLabel={`${item.name}, ${kindTitle} in ${item.area}${now != null ? `, ${formatAed(now)} per month` : ''}`}
          onPress={() => navigation.navigate('ResidenceDetail', { residenceId: item.id })}
        >
          <View style={styles.photoWrap}>
            {item.photo_urls[0] ? (
              <Image source={{ uri: item.photo_urls[0] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityLabel={`Photo of ${item.name}`} />
            ) : (
              <PhotoPlaceholder icon="home" style={StyleSheet.absoluteFill} />
            )}
            <View style={styles.photoBadge}>{item.is_sample ? <SampleTag /> : item.is_verified ? <VerifiedBadge /> : isDeal(item) ? <DealTag /> : null}</View>
            <AnimatedPressable style={styles.saveBtn} scaleTo={0.92} onPress={() => toggleSaved(item)} accessibilityRole="button" accessibilityLabel={isSaved ? 'Remove from saved' : 'Save this place'}>
              <BurstHeart active={isSaved} size={20} color={colors.coral} activeColor={colors.coral} />
            </AnimatedPressable>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.priceRow}>
              <View style={styles.priceLine}>
                {now != null ? <Text style={styles.price}>{formatAed(now)}</Text> : <Text style={styles.priceMissing}>Price on request</Text>}
                {now != null ? <Text style={styles.per}>{home ? 'per month for the home' : 'per month'}</Text> : null}
                {was != null ? <Text style={styles.was}>{formatAed(was)}</Text> : null}
              </View>
              {item.bills_included === true ? <BillsTag /> : null}
            </View>
            {each ? <Text style={styles.each}>{each}</Text> : null}
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.kindSub}>
              {kindTitle} · {item.area}{item.bills_included !== true ? ` · ${billsLine(item).replace(/^Bills/, 'bills')}` : ''}
            </Text>
            {commute ? (
              <View style={styles.metaRow}>
                <Icon name="bus" size={16} color={colors.coral} />
                <Text style={styles.meta}>{commuteText(commute)} to {commute.university}</Text>
              </View>
            ) : null}
          </View>
        </AnimatedPressable>
        {index === 0 ? banner(item.area) : null}
      </>
    );
  };

  let empty: React.ReactNode;
  if (!loaded) {
    empty = (
      <View style={{ marginTop: 4 }} accessibilityLabel="Loading places">
        {[0, 1].map((i) => (
          <View key={i} style={styles.card}>
            <Skeleton style={{ height: 178, borderRadius: 0 }} />
            <View style={{ padding: 16, gap: 10 }}>
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

  const footer = loaded && !loadFailed ? (
    <Pressable style={styles.guideRow} onPress={() => navigation.navigate('Guide')} accessibilityRole="link" accessibilityLabel="New to renting in Dubai? Read the guide">
      <Icon name="book-open" size={16} color={colors.coral} />
      <Text style={styles.guideRowText}>New to renting in Dubai? Read the guide</Text>
      <Icon name="chevron-right" size={13} color={colors.inkSoft} />
    </Pressable>
  ) : undefined;

  return (
    <View style={styles.container}>
      <FlatList
        data={loaded && !loadFailed ? visible : []}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 140, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
      />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 54 },
    brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    loginBtn: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    loginText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 15, color: colors.ink },
    iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 31, lineHeight: 34, letterSpacing: -0.8, color: colors.ink, paddingHorizontal: 20, marginTop: 18 },
    search: {
      flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 16, height: 52, paddingHorizontal: 16,
      borderRadius: FIELD_RADIUS, borderWidth: 1.5, borderColor: colors.fieldLine, backgroundColor: colors.white,
    },
    searchInput: { flex: 1, fontFamily: 'HankenGrotesk_500Medium', fontSize: 15, color: colors.ink, height: 50, outlineStyle: 'none' } as never,
    clearBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
    chipScroller: { flexGrow: 0, marginTop: 12 },
    chipRow: { gap: 8, paddingHorizontal: 20 },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20,
      borderWidth: 1.5, borderColor: colors.fieldLine, backgroundColor: colors.white,
    },
    chipSelected: { backgroundColor: colors.coralFill, borderColor: colors.coralFill },
    chipOpen: { borderColor: colors.ink },
    chipText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 13, color: colors.ink },
    chipTextSelected: { color: '#FFFFFF' },
    panel: { marginHorizontal: 20, marginTop: 10, padding: 16, borderRadius: CARD_RADIUS, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
    panelTitle: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, color: colors.ink, marginBottom: 10 },
    optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    option: {
      flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 20,
      borderWidth: 1.5, borderColor: colors.fieldLine, backgroundColor: colors.white,
    },
    panelFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
    countRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 8, minHeight: 44 },
    count: { flex: 1, fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, color: colors.ink },
    sortBtn: { minHeight: 44, justifyContent: 'center' },
    sortText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.inkSoft },
    sortMenu: { marginHorizontal: 20, marginBottom: 8, backgroundColor: colors.white, borderRadius: FIELD_RADIUS, borderWidth: 1, borderColor: colors.line },
    sortItem: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
    sortItemText: { fontSize: 15, color: colors.ink },
    card: { backgroundColor: colors.white, borderRadius: CARD_RADIUS, borderWidth: 1, borderColor: colors.line, overflow: 'hidden', marginBottom: 16, marginHorizontal: 20 },
    photoWrap: { height: 178, backgroundColor: colors.photo },
    photoBadge: { position: 'absolute', top: 12, left: 12 },
    saveBtn: { position: 'absolute', top: 10, right: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
    cardBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 6 },
    priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    priceLine: { flex: 1, flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6 },
    price: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 24, letterSpacing: -0.5, color: colors.ink },
    priceMissing: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 20, letterSpacing: -0.4, color: colors.ink },
    was: { fontSize: 14, color: colors.inkSoft, textDecorationLine: 'line-through' },
    per: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.inkSoft },
    each: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, color: colors.mintText },
    name: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 16, lineHeight: 21, color: colors.ink },
    kindSub: { fontSize: 14, lineHeight: 19, color: colors.inkSoft },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    meta: { flex: 1, fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink },
    banner: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.mintBg, marginHorizontal: 20, marginBottom: 16 },
    bannerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
    bannerTitle: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 15, color: colors.mintText },
    bannerSub: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 13, color: colors.mintText },
    guideRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginHorizontal: 20 },
    guideRowText: { flex: 1, fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink },
  });
}
