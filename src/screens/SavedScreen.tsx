import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text } from '@/components/Text';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Icon from '@/components/Icon';
import AnimatedPressable from '@/components/AnimatedPressable';
import BurstHeart from '@/components/BurstHeart';
import PhotoPlaceholder from '@/components/PhotoPlaceholder';
import Skeleton from '@/components/Skeleton';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { formatAed, setResidenceSaved } from '@/lib/housing';
import { LISTING_TYPE_LABEL } from '@/lib/listing';
import { BillsTag, DealTag, OutlineButton, StateBlock } from '@/components/housing/parts';
import { useCompareIds } from '@/components/housing/compareStore';
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
  const compareCount = useCompareIds().length;

  const [rows, setRows] = useState<Residence[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!myId) { setRows([]); setLoaded(true); return; }
    try {
      const saved = await supabase.from('saved_residences').select('residence_id, created_at').eq('user_id', myId).order('created_at', { ascending: false });
      if (saved.error) throw saved.error;
      const ids = ((saved.data as { residence_id: string }[]) ?? []).map((r) => r.residence_id);
      if (ids.length === 0) { setRows([]); setFailed(false); setLoaded(true); return; }
      const res = await supabase.from('residences').select('*, room_types(*)').eq('is_active', true).in('id', ids);
      if (res.error) throw res.error;
      setRows(orderByIds((res.data as Residence[]) ?? [], ids));
      setFailed(false);
    } catch {
      setRows([]);
      setFailed(true);
    }
    setLoaded(true);
  }, [myId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const unsave = async (r: Residence) => {
    if (!myId) return;
    const before = rows;
    setRows((prev) => prev.filter((x) => x.id !== r.id));
    try {
      await setResidenceSaved(myId, r.id, false);
    } catch {
      setRows(before);
      showToast('Couldn’t remove it from your saved list. Try again.', 'error');
    }
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} accessibilityRole="header">Saved</Text>
        <Text style={styles.count}>{rows.length === 1 ? '1 place' : `${rows.length} places`}</Text>
      </View>
      {compareCount > 0 ? (
        <OutlineButton label={`Compare (${compareCount})`} onPress={() => navigation.navigate('Compare')} height={44} />
      ) : null}
    </View>
  );

  if (!loaded) {
    return (
      <View style={styles.container} accessibilityLabel="Loading saved places">
        {header}
        {[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 96, marginHorizontal: 16, marginBottom: 12, borderRadius: 14 }} />)}
      </View>
    );
  }
  if (failed) {
    return (
      <View style={styles.container}>
        {header}
        <StateBlock icon="alert-circle" kind="error" title="We could not load your saved places" body="Check your connection and try again. Nothing you saved has been lost."
          primary={{ label: 'Try again', onPress: () => { setLoaded(false); load(); } }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 130, flexGrow: 1 }}
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
                    <Icon name="bus" size={14} color={colors.inkSoft} />
                    <Text style={styles.meta} numberOfLines={1}>{commuteText(commute)} to {commute.university}</Text>
                  </View>
                ) : null}
              </View>
              <AnimatedPressable style={styles.heart} scaleTo={0.92} onPress={() => unsave(item)} accessibilityRole="button" accessibilityLabel={`Remove ${item.name} from saved`}>
                <BurstHeart active size={20} color="#1F1B16" activeColor={colors.coral} />
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
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
    title: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 30, letterSpacing: -0.6, color: colors.ink },
    count: { fontSize: 14, color: colors.inkSoft, marginTop: 2 },
    row: { flexDirection: 'row', gap: 12, backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 10, marginHorizontal: 16, marginBottom: 12 },
    thumb: { width: 96, height: 96, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.sandDeep },
    body: { flex: 1, gap: 3, paddingRight: 36 },
    priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
    price: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 20, color: colors.ink },
    priceMissing: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 16, color: colors.inkSoft },
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
