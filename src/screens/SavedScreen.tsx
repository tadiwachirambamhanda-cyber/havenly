import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text } from '@/components/Text';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Icon from '@/components/Icon';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import BurstHeart from '@/components/BurstHeart';
import PhotoPlaceholder from '@/components/PhotoPlaceholder';
import Skeleton from '@/components/Skeleton';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { formatAed, setResidenceSaved } from '@/lib/housing';
import { LISTING_TYPE_LABEL } from '@/lib/listing';
import { BillsTag, CARD_RADIUS, DealTag, StateBlock } from '@/components/housing/parts';
import { billsLine, commuteText, isDeal, isWholeHome, orderByIds, pickCommute, priceInfo } from '@/components/housing/listingModel';
import type { ColorTokens } from '@/theme/tokens';
import type { Residence } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SavedScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;
  const myUniversity = profile?.university ?? null;

  // The loaded list is tagged with the account it was loaded for. A slow load that finishes after the
  // account changed is tagged with the old account and is never shown, so one person never sees another's
  // saved places on a shared device.
  const [data, setData] = useState<{ owner: string | undefined; rows: Residence[]; failed: boolean } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const current = data && data.owner === myId ? data : null;
  const loaded = current !== null;
  const rows = useMemo(() => current?.rows ?? [], [current]);
  const failed = current?.failed ?? false;

  const load = useCallback(async () => {
    if (!myId) { setData({ owner: myId, rows: [], failed: false }); return; }
    try {
      const saved = await supabase.from('saved_residences').select('residence_id, created_at').eq('user_id', myId).order('created_at', { ascending: false });
      if (saved.error) throw saved.error;
      const ids = ((saved.data as { residence_id: string }[]) ?? []).map((r) => r.residence_id);
      if (ids.length === 0) { setData({ owner: myId, rows: [], failed: false }); return; }
      const res = await supabase.from('residences').select('*, room_types(*)').eq('is_active', true).in('id', ids);
      if (res.error) throw res.error;
      setData({ owner: myId, rows: orderByIds((res.data as Residence[]) ?? [], ids), failed: false });
    } catch {
      setData({ owner: myId, rows: [], failed: true });
    }
  }, [myId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const unsave = async (r: Residence) => {
    if (!myId) return;
    const index = rows.findIndex((x) => x.id === r.id);
    const edit = (change: (list: Residence[]) => Residence[]) =>
      setData((prev) => (prev && prev.owner === myId ? { ...prev, rows: change(prev.rows) } : prev));
    edit((list) => list.filter((x) => x.id !== r.id));
    try {
      await setResidenceSaved(myId, r.id, false);
    } catch {
      // Put back only this place, so another removal that already succeeded stays removed.
      edit((list) => {
        if (list.some((x) => x.id === r.id)) return list;
        const next = [...list];
        next.splice(Math.min(Math.max(index, 0), next.length), 0, r);
        return next;
      });
      showToast('Couldn’t remove it from your saved list. Try again.', 'error');
    }
  };

  // Saved is a screen opened from Housing (no longer a tab), so it has its own way back.
  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <BackButton style={styles.back}>
        <Icon name="arrow-left" size={18} color={colors.ink} />
      </BackButton>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} accessibilityRole="header">Saved</Text>
        <Text style={styles.count}>{rows.length === 1 ? '1 place' : `${rows.length} places`}</Text>
      </View>
    </View>
  );

  if (!loaded) {
    return (
      <View style={styles.container} accessibilityLabel="Loading saved places">
        {header}
        {[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 118, marginHorizontal: 20, marginBottom: 12, borderRadius: CARD_RADIUS }} />)}
      </View>
    );
  }
  if (failed) {
    return (
      <View style={styles.container}>
        {header}
        <StateBlock icon="alert-circle" kind="error" title="We could not load your saved places" body="Check your connection and try again. Nothing you saved has been lost."
          primary={{ label: 'Try again', onPress: () => { setData(null); load(); } }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
        ListEmptyComponent={
          <StateBlock icon="heart" title="Nothing saved yet" body="Tap the heart on a place to keep it here."
            primary={{ label: 'Find a place', onPress: () => navigation.navigate('MainTabs', { screen: 'Housing' }) }} />
        }
        renderItem={({ item }) => {
          const { now, was } = priceInfo(item);
          const commute = pickCommute(item, myUniversity);
          const kind = `${item.listing_type === 'home' && item.bedrooms ? `Whole ${item.bedrooms} bedroom home` : LISTING_TYPE_LABEL[item.listing_type]} in ${item.area}`;
          return (
            <AnimatedPressable
              style={styles.row}
              scaleTo={0.99}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${kind}${now != null ? `, ${formatAed(now)} per month` : ''}`}
              onPress={() => navigation.navigate('ResidenceDetail', { residenceId: item.id })}
            >
              <View style={styles.thumb}>
                {item.photo_urls[0] ? (
                  <Image source={{ uri: item.photo_urls[0] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                ) : (
                  <PhotoPlaceholder icon="home" style={StyleSheet.absoluteFill} />
                )}
              </View>
              <View style={styles.body}>
                <View style={styles.priceLine}>
                  {now != null ? <Text style={styles.price}>{formatAed(now)}</Text> : <Text style={styles.priceMissing}>Price on request</Text>}
                  {was != null ? <Text style={styles.was}>{formatAed(was)}</Text> : null}
                  {now != null ? <Text style={styles.per}>{isWholeHome(item) ? 'a month, whole home' : 'a month'}</Text> : null}
                </View>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.kind} numberOfLines={1}>{kind}</Text>
                <View style={styles.tags}>
                  {item.bills_included === true ? <BillsTag /> : <Text style={styles.bills} numberOfLines={2}>{billsLine(item)}</Text>}
                  {isDeal(item) ? <DealTag /> : null}
                </View>
                {commute ? (
                  <View style={styles.metaRow}>
                    <Icon name="bus" size={14} color={colors.coral} />
                    <Text style={styles.meta} numberOfLines={1}>{commuteText(commute)} to {commute.university}</Text>
                  </View>
                ) : null}
              </View>
              <AnimatedPressable style={styles.heart} scaleTo={0.92} onPress={() => unsave(item)} accessibilityRole="button" accessibilityLabel={`Remove ${item.name} from saved`}>
                <BurstHeart active size={20} color={colors.coral} activeColor={colors.coral} />
              </AnimatedPressable>
            </AnimatedPressable>
          );
        }}
      />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, gap: 12 },
    back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 31, lineHeight: 34, letterSpacing: -0.8, color: colors.ink },
    count: { fontSize: 14, color: colors.inkSoft, marginTop: 2 },
    row: { flexDirection: 'row', gap: 12, backgroundColor: colors.white, borderRadius: CARD_RADIUS, borderWidth: 1, borderColor: colors.line, padding: 10, marginHorizontal: 20, marginBottom: 12 },
    thumb: { width: 96, height: 96, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.photo },
    body: { flex: 1, gap: 3, paddingRight: 36 },
    priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
    price: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 20, letterSpacing: -0.4, color: colors.ink },
    priceMissing: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 16, color: colors.inkSoft },
    was: { fontSize: 13, color: colors.inkSoft, textDecorationLine: 'line-through' },
    per: { fontSize: 12, color: colors.inkSoft },
    name: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 15, color: colors.ink },
    kind: { fontSize: 13, color: colors.inkBody },
    tags: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    bills: { fontSize: 12, color: colors.inkMuted },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    meta: { flex: 1, fontSize: 12.5, color: colors.inkSoft },
    heart: { position: 'absolute', top: 2, right: 2, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  });
}
