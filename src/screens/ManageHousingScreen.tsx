import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ScrollView } from 'react-native';
import { Text } from '@/components/Text';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import PhotoPlaceholder from '@/components/PhotoPlaceholder';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { haptics } from '@/lib/haptics';
import { ADMIN_STATUS_LABEL, ENQUIRY_STATUSES, formatAed, formatMonth } from '@/lib/housing';
import { timeAgo } from '@/utils/timeAgo';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import EmptyState from '@/components/EmptyState';
import PersonRowSkeleton from '@/components/PersonRowSkeleton';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { EnquiryStatus, HousingEnquiry, Residence, ResidencePartnerTerms } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'enquiries' | 'residences';

// Admin-only (reached from Settings, and every table behind it is
// admin-gated by RLS) — the team's view of the referral pipeline and of
// what each partner residence owes.
export default function ManageHousingScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState<Tab>('enquiries');
  const [statusFilter, setStatusFilter] = useState<EnquiryStatus | 'all'>('all');
  const [enquiries, setEnquiries] = useState<HousingEnquiry[]>([]);
  const [residences, setResidences] = useState<Residence[]>([]);
  const [termsByResidence, setTermsByResidence] = useState<Map<string, ResidencePartnerTerms>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [{ data: enquiryRows }, { data: residenceRows }, { data: termRows }] = await Promise.all([
      supabase.from('housing_enquiries')
        .select('*, user:profiles(id, display_name, username, avatar_url, university), residence:residences(id, name, area, photo_urls, provider_name)')
        .order('created_at', { ascending: false }),
      supabase.from('residences').select('*, room_types(id)').order('created_at', { ascending: false }),
      supabase.from('residence_partner_terms').select('*'),
    ]);
    setEnquiries((enquiryRows as unknown as HousingEnquiry[]) ?? []);
    setResidences((residenceRows as unknown as Residence[]) ?? []);
    setTermsByResidence(new Map(((termRows as ResidencePartnerTerms[]) ?? []).map((t) => [t.residence_id, t])));
    setLoaded(true);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const totals = useMemo(() => {
    let owed = 0;
    let received = 0;
    for (const e of enquiries) {
      if (e.status !== 'signed' || e.referral_fee_aed == null) continue;
      if (e.fee_paid_at) received += Number(e.referral_fee_aed); else owed += Number(e.referral_fee_aed);
    }
    return {
      newCount: enquiries.filter((e) => e.status === 'new').length,
      signedCount: enquiries.filter((e) => e.status === 'signed').length,
      owed,
      received,
    };
  }, [enquiries]);

  const visibleEnquiries = statusFilter === 'all' ? enquiries : enquiries.filter((e) => e.status === statusFilter);

  const tone = (status: EnquiryStatus) => {
    if (status === 'signed') return { bg: colors.ink, fg: colors.white };
    if (status === 'lost') return { bg: colors.sandDeep, fg: colors.inkSoft };
    if (status === 'new') return { bg: colors.coralSoft, fg: colors.coral };
    return { bg: colors.tintBg, fg: colors.tintText };
  };

  const renderEnquiries = () => (
    <FlatList
      data={visibleEnquiries}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 40, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
      ListHeaderComponent={
        <>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totals.newCount}</Text>
              <Text style={styles.statLabel}>New to handle</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totals.signedCount}</Text>
              <Text style={styles.statLabel}>Signed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: colors.coral }]}>{formatAed(totals.owed)}</Text>
              <Text style={styles.statLabel}>Fees owed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{formatAed(totals.received)}</Text>
              <Text style={styles.statLabel}>Fees received</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {(['all', ...ENQUIRY_STATUSES] as const).map((s) => {
              const selected = statusFilter === s;
              return (
                <AnimatedPressable key={s} style={[styles.chip, selected && styles.chipSelected]} onPress={() => { haptics.tap(); setStatusFilter(s); }}>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{s === 'all' ? 'All' : ADMIN_STATUS_LABEL[s]}</Text>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        </>
      }
      ListEmptyComponent={loaded ? <EmptyState icon="inbox" text="No enquiries here yet." /> : <PersonRowSkeleton count={5} />}
      renderItem={({ item }) => {
        const t = tone(item.status);
        return (
          <AnimatedPressable style={styles.row} onPress={() => navigation.navigate('AdminEnquiry', { enquiryId: item.id })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.user?.display_name ?? 'Deleted account'} → {item.residence?.name ?? 'Listing'}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {item.kind === 'viewing' ? 'Viewing' : 'Question'} · {formatMonth(item.move_in_month)} · {item.duration_months} mo · {timeAgo(item.created_at)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={[styles.statusPill, { backgroundColor: t.bg }]}>
                <Text style={[styles.statusText, { color: t.fg }]}>{ADMIN_STATUS_LABEL[item.status]}</Text>
              </View>
              {item.status === 'signed' && item.referral_fee_aed != null && (
                <Text style={styles.feeText}>{formatAed(Number(item.referral_fee_aed))}{item.fee_paid_at ? ' · paid' : ''}</Text>
              )}
            </View>
          </AnimatedPressable>
        );
      }}
    />
  );

  const renderResidences = () => (
    <FlatList
      data={residences}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 40, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
      ListHeaderComponent={
        <AnimatedPressable style={styles.addBtn} onPress={() => navigation.navigate('EditResidence', {})}>
          <Icon name="plus" size={16} color="white" />
          <Text style={styles.addBtnText}>Add listing</Text>
        </AnimatedPressable>
      }
      ListEmptyComponent={loaded ? <EmptyState icon="home" text="No listings yet. Add your first one." /> : <PersonRowSkeleton count={4} thumb="square" />}
      renderItem={({ item }) => {
        const terms = termsByResidence.get(item.id);
        return (
          <AnimatedPressable style={styles.row} onPress={() => navigation.navigate('EditResidence', { residenceId: item.id })}>
            {item.photo_urls[0] ? (
              <Image source={{ uri: item.photo_urls[0] }} style={styles.thumb} contentFit="cover" transition={200} />
            ) : (
              <PhotoPlaceholder icon="home" style={styles.thumb} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {item.area} · {item.room_types?.length ?? 0} room types · {terms ? `${Number(terms.referral_fee_percent)}% fee` : 'no fee set'}
              </Text>
            </View>
            {!item.is_active && (
              <View style={[styles.statusPill, { backgroundColor: colors.sandDeep }]}>
                <Text style={[styles.statusText, { color: colors.inkSoft }]}>Hidden</Text>
              </View>
            )}
            {!terms && <Icon name="alert-circle" size={20} color={colors.errorText} />}
          </AnimatedPressable>
        );
      }}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton style={styles.back}>
          <Icon name="arrow-left" size={17} color={colors.ink} />
        </BackButton>
        <Text style={styles.title}>Manage housing</Text>
      </View>
      <View style={styles.segment}>
        {(['enquiries', 'residences'] as Tab[]).map((t) => (
          <AnimatedPressable key={t} style={[styles.segmentItem, tab === t && styles.segmentItemActive]} onPress={() => { haptics.tap(); setTab(t); }}>
            <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
              {t === 'enquiries' ? `Enquiries${totals.newCount ? ` (${totals.newCount} new)` : ''}` : 'Listings'}
            </Text>
          </AnimatedPressable>
        ))}
      </View>
      {tab === 'enquiries' ? renderEnquiries() : renderResidences()}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 54, paddingBottom: 12, paddingHorizontal: spacing.lg },
    back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 24, letterSpacing: -0.4, color: colors.ink },
    segment: {
      flexDirection: 'row', marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: 4,
      backgroundColor: colors.sandDeep, borderRadius: radius.pill,
    },
    segmentItem: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
    segmentItemActive: { backgroundColor: colors.ink },
    segmentText: { fontSize: 14, fontWeight: '600', color: colors.inkSoft },
    segmentTextActive: { color: colors.white, fontWeight: '700' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    statCard: {
      flexGrow: 1, flexBasis: '45%', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
      borderRadius: radius.md, padding: 14,
    },
    statValue: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 22, color: colors.ink },
    statLabel: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
    filterRow: { gap: 8, paddingVertical: 14 },
    chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white, justifyContent: 'center' },
    chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipText: { fontSize: 14, fontWeight: '500', color: colors.ink },
    chipTextSelected: { color: colors.white, fontWeight: '600' },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderWidth: 1,
      borderColor: colors.line, borderRadius: radius.md, padding: 14, marginBottom: 10, minHeight: 64,
    },
    rowTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
    rowMeta: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 12, fontWeight: '700' },
    feeText: { fontSize: 13, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
    thumb: { width: 56, height: 56, borderRadius: 10 },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.coral,
      minHeight: 52, borderRadius: 12, marginBottom: 14,
    },
    addBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },
  });
}
