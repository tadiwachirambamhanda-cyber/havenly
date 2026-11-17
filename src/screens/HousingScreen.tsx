import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ScrollView } from 'react-native';
import { Text } from '@/components/Text';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import PhotoPlaceholder from '@/components/PhotoPlaceholder';
import Icon, { type IconName } from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { annualPrice, cheapestRoom, formatAed, GENDER_POLICY_LABEL, PERIOD_LABEL, setResidenceSaved } from '@/lib/housing';
import AnimatedPressable from '@/components/AnimatedPressable';
import BurstHeart from '@/components/BurstHeart';
import EmptyState from '@/components/EmptyState';
import Skeleton from '@/components/Skeleton';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { Residence } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Budget = 'any' | 'under40' | '40to60' | 'over60';

const BUDGETS: { key: Budget; label: string }[] = [
  { key: 'under40', label: 'Under 40k / yr' },
  { key: '40to60', label: '40–60k / yr' },
  { key: 'over60', label: '60k+ / yr' },
];

function inBudget(yearly: number, budget: Budget): boolean {
  if (budget === 'under40') return yearly < 40000;
  if (budget === '40to60') return yearly >= 40000 && yearly <= 60000;
  if (budget === 'over60') return yearly > 60000;
  return true;
}

export default function HousingScreen() {
  const navigation = useNavigation<Nav>();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;
  const myUniversity = profile?.university ?? null;

  const [residences, setResidences] = useState<Residence[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nearMyUni, setNearMyUni] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [budget, setBudget] = useState<Budget>('any');

  const load = useCallback(async () => {
    const [{ data: residenceRows }, { data: savedRows }] = await Promise.all([
      supabase.from('residences').select('*, room_types(*)').eq('is_active', true).order('created_at', { ascending: false }),
      myId ? supabase.from('saved_residences').select('residence_id').eq('user_id', myId) : Promise.resolve({ data: [] }),
    ]);
    setResidences((residenceRows as Residence[]) ?? []);
    setSavedIds(new Set(((savedRows as { residence_id: string }[]) ?? []).map((r) => r.residence_id)));
    setLoaded(true);
  }, [myId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggleSaved = async (residence: Residence) => {
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

  const visible = useMemo(() => residences.filter((r) => {
    if (savedOnly && !savedIds.has(r.id)) return false;
    if (nearMyUni && myUniversity && !r.nearby_universities.includes(myUniversity)) return false;
    if (budget !== 'any') {
      const room = cheapestRoom(r);
      if (!room || !inBudget(annualPrice(room), budget)) return false;
    }
    return true;
  }), [residences, savedIds, savedOnly, nearMyUni, myUniversity, budget]);

  const filtersActive = savedOnly || nearMyUni || budget !== 'any';

  const chip = (key: string, label: string, selected: boolean, onPress: () => void, icon?: IconName) => (
    <AnimatedPressable key={key} style={[styles.chip, selected && styles.chipSelected]} onPress={() => { haptics.tap(); onPress(); }}>
      {icon && <Icon name={icon} size={12} color={selected ? colors.sand : colors.ink} />}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </AnimatedPressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Housing</Text>
          <Text style={styles.subtitle}>Student rooms, checked by the Havenly team</Text>
        </View>
        <AnimatedPressable hitSlop={8} style={styles.iconBtn} onPress={() => navigation.navigate('MyEnquiries')} accessibilityLabel="My enquiries">
          <Icon name="clipboard" size={16} color={colors.ink} />
        </AnimatedPressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} style={styles.chipScroller}>
        {myUniversity && chip('near', 'Near my uni', nearMyUni, () => setNearMyUni((v) => !v), 'map-pin')}
        {chip('saved', 'Saved', savedOnly, () => setSavedOnly((v) => !v), 'heart')}
        {BUDGETS.map((b) => chip(b.key, b.label, budget === b.key, () => setBudget((cur) => (cur === b.key ? 'any' : b.key))))}
      </ScrollView>

      {!loaded ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: 16, marginTop: spacing.md }}>
          {[0, 1].map((i) => (
            <View key={i} style={styles.card}>
              <Skeleton style={{ height: 180, borderRadius: 0 }} />
              <View style={{ padding: 14, gap: 8 }}>
                <Skeleton style={{ height: 16, width: '60%' }} />
                <Skeleton style={{ height: 12, width: '40%' }} />
                <Skeleton style={{ height: 14, width: '35%' }} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 120, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
          ListEmptyComponent={
            <EmptyState
              icon={filtersActive ? 'filter' : 'home'}
              text={filtersActive ? 'Nothing matches those filters.' : 'No residences listed yet. We’re adding partners near the main campuses.'}
              action={filtersActive ? { label: 'Clear filters', onPress: () => { setSavedOnly(false); setNearMyUni(false); setBudget('any'); } } : undefined}
            />
          }
          renderItem={({ item, index }) => {
            const room = cheapestRoom(item);
            const isSaved = savedIds.has(item.id);
            const nearMine = !!myUniversity && item.nearby_universities.includes(myUniversity);
            return (
              <Animated.View>
                <AnimatedPressable style={styles.card} scaleTo={0.98} onPress={() => navigation.navigate('ResidenceDetail', { residenceId: item.id })}>
                  <View style={styles.photoWrap}>
                    {item.photo_urls[0] ? (
                      <Image source={{ uri: item.photo_urls[0] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                    ) : (
                      <PhotoPlaceholder icon="home" style={StyleSheet.absoluteFill} />
                    )}
                    <AnimatedPressable hitSlop={8} style={styles.saveBtn} scaleTo={0.92} onPress={() => toggleSaved(item)} accessibilityLabel={isSaved ? 'Remove from saved' : 'Save residence'}>
                      <BurstHeart active={isSaved} size={16} color="#1F1B16" activeColor="#FF5A3C" />
                    </AnimatedPressable>
                    {nearMine && (
                      <View style={styles.nearBadge}>
                        <Icon name="map-pin" size={10} color="white" />
                        <Text style={styles.nearBadgeText}>Near your uni</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardArea}>{item.area}</Text>
                    <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.cardMetaRow}>
                      {room ? (
                        <Text style={styles.cardPrice}>
                          from <Text style={styles.cardPriceStrong}>{formatAed(room.price_aed)}</Text> / {PERIOD_LABEL[room.billing_period]}
                        </Text>
                      ) : (
                        <Text style={styles.cardPrice}>Currently full</Text>
                      )}
                      {item.gender_policy !== 'mixed' && (
                        <View style={styles.policyPill}>
                          <Text style={styles.policyPillText}>{GENDER_POLICY_LABEL[item.gender_policy]}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </AnimatedPressable>
              </Animated.View>
            );
          }}
        />
      )}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingTop: 60 },
    title: { fontFamily: 'SchibstedGrotesk_600SemiBold', fontSize: 26, color: colors.ink },
    subtitle: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
    iconBtn: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
      alignItems: 'center', justifyContent: 'center',
    },
    chipScroller: { flexGrow: 0, marginTop: 14 },
    chipRow: { gap: 8, paddingHorizontal: spacing.lg },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 13,
      borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white,
    },
    chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipText: { fontSize: 12.5, fontWeight: '600', color: colors.ink },
    chipTextSelected: { color: colors.sand },
    card: {
      backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
      overflow: 'hidden', marginBottom: 16,
    },
    photoWrap: { height: 180, backgroundColor: colors.sandDeep },
    saveBtn: {
      position: 'absolute', top: 12, right: 12, width: 34, height: 34, borderRadius: 17,
      backgroundColor: 'rgba(251,245,234,0.92)', alignItems: 'center', justifyContent: 'center',
    },
    nearBadge: {
      position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: 'rgba(15,139,130,0.92)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.tag,
    },
    nearBadgeText: { color: 'white', fontSize: 11, fontWeight: '700' },
    cardBody: { padding: 14 },
    cardArea: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.teal },
    cardName: { fontFamily: 'SchibstedGrotesk_600SemiBold', fontSize: 18, color: colors.ink, marginTop: 3 },
    cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    cardPrice: { fontSize: 12.5, color: colors.inkSoft },
    cardPriceStrong: { fontWeight: '800', color: colors.ink },
    policyPill: { backgroundColor: colors.sandDeep, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.tag },
    policyPillText: { fontSize: 10.5, fontWeight: '700', color: colors.inkSoft },
  });
}
