import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from '@/components/Text';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import PhotoPlaceholder from '@/components/PhotoPlaceholder';
import Icon from '@/components/Icon';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import Skeleton from '@/components/Skeleton';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useRequireAccount } from '@/lib/requireAccount';
import { formatAed, GENDER_POLICY_LABEL } from '@/lib/housing';
import { LISTING_TYPE_LABEL } from '@/lib/listing';
import { formatAedAmount, formatAedRange, defaultPeople, splitRent } from '@/lib/rentSplit';
import { PrimaryButton, StateBlock } from '@/components/housing/parts';
import { MAX_COMPARE, removeFromCompare, useCompareIds } from '@/components/housing/compareStore';
import { billsInputOf, billsLine, isDeal, isWholeHome, pickCommute, priceInfo, commuteText } from '@/components/housing/listingModel';
import type { ColorTokens } from '@/theme/tokens';
import type { Residence } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CompareScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const requireAccount = useRequireAccount();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const ids = useCompareIds();
  const myUniversity = profile?.university ?? null;

  const [rows, setRows] = useState<Residence[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (ids.length === 0) { setRows([]); setLoaded(true); return; }
    try {
      const { data, error } = await supabase.from('residences').select('*, room_types(*)').eq('is_active', true).in('id', [...ids]);
      if (error) throw error;
      const found = (data as Residence[]) ?? [];
      setRows(ids.map((id) => found.find((r) => r.id === id)).filter((r): r is Residence => !!r));
      setFailed(false);
    } catch {
      setFailed(true);
    }
    setLoaded(true);
  }, [ids]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // A place that is no longer listed drops out of the list.
  useEffect(() => {
    if (!loaded || failed) return;
    ids.forEach((id) => { if (!rows.some((r) => r.id === id)) removeFromCompare(id); });
  }, [loaded, failed, rows, ids]);

  const shownRows = rows.filter((r) => ids.includes(r.id));
  const chosenId = chosen && shownRows.some((r) => r.id === chosen) ? chosen : shownRows.length === 1 ? shownRows[0].id : null;

  const enquire = () => {
    if (!chosenId) return;
    if (!requireAccount('enquire', chosenId)) return;
    navigation.navigate('HousingEnquiry', { residenceId: chosenId, kind: 'viewing' });
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      {route.name === 'Compare' && <BackButton style={styles.backBtn}><Icon name="arrow-left" size={20} color={colors.ink} /></BackButton>}
      <View style={{ flex: 1 }}>
        <Text style={styles.title} accessibilityRole="header">Compare</Text>
        <Text style={styles.count}>{ids.length} of {MAX_COMPARE} places</Text>
      </View>
    </View>
  );

  if (!loaded) {
    return (
      <View style={styles.container} accessibilityLabel="Loading">
        {header}
        <View style={{ flexDirection: 'row', gap: 8, padding: 16 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} style={{ flex: 1, height: 160, borderRadius: 12 }} />)}
        </View>
      </View>
    );
  }
  if (failed) {
    return (
      <View style={styles.container}>
        {header}
        <StateBlock icon="alert-circle" kind="error" title="We could not load your saved places" body="Check your connection and try again."
          primary={{ label: 'Try again', onPress: () => { setLoaded(false); load(); } }} />
      </View>
    );
  }
  if (shownRows.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <StateBlock icon="heart" title="Save places to compare them" body="Open a listing and choose Add to compare, then come back here to see up to 3 side by side."
          primary={{ label: 'Find a place', onPress: () => navigation.goBack() }} />
      </View>
    );
  }

  const slots: (Residence | null)[] = [...shownRows, ...Array(Math.max(0, MAX_COMPARE - shownRows.length)).fill(null)];

  const rowOf = (label: string, cell: (r: Residence) => React.ReactNode) => (
    <View key={label}>
      <Text style={styles.lbl}>{label}</Text>
      <View style={styles.row}>
        {slots.map((r, i) => (
          <View key={r?.id ?? `empty-${i}`} style={r ? styles.cell : styles.cellEmpty}>{r ? cell(r) : null}</View>
        ))}
      </View>
    </View>
  );

  const each = (r: Residence) => {
    const { now, was } = priceInfo(r);
    if (now == null) return <Text style={styles.cellText}>Price on request</Text>;
    if (isWholeHome(r)) {
      const people = defaultPeople(r.bedrooms);
      const s = splitRent({ rentAed: now, bills: billsInputOf(r), people });
      if (s) {
        return (
          <>
            <Text style={styles.bold}>{formatAedRange(s.monthlyEachMin, s.monthlyEachMax)}</Text>
            <Text style={styles.sub}>{people} people{s.bills.kind === 'range' ? ', bills estimated' : ''}</Text>
          </>
        );
      }
    }
    return (
      <>
        <Text style={styles.bold}>{formatAed(now)}</Text>
        {was != null ? <Text style={[styles.sub, { textDecorationLine: 'line-through' }]}>{formatAed(was)}</Text> : null}
        {isDeal(r) ? <Text style={[styles.sub, { color: colors.dealText, fontFamily: 'HankenGrotesk_700Bold' }]}>Student deal</Text> : null}
      </>
    );
  };

  return (
    <View style={styles.container}>
      {header}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}>
        <View style={[styles.row, { paddingTop: 8 }]}>
          {slots.map((r, i) => r ? (
            <View key={r.id} style={styles.col}>
              <View style={styles.photo}>
                {r.photo_urls[0] ? <Image source={{ uri: r.photo_urls[0] }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <PhotoPlaceholder icon="home" style={StyleSheet.absoluteFill} />}
              </View>
              <Text style={styles.colName} numberOfLines={3}>{r.name}</Text>
              <AnimatedPressable
                style={[styles.choose, chosenId === r.id && styles.chooseOn]}
                onPress={() => setChosen(r.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: chosenId === r.id }}
                accessibilityLabel={`${chosenId === r.id ? 'Chosen' : 'Choose'}: ${r.name}`}
              >
                {chosenId === r.id ? <Icon name="check" size={14} color="#FFFFFF" /> : null}
                <Text style={[styles.chooseText, chosenId === r.id && { color: '#FFFFFF' }]}>{chosenId === r.id ? 'Chosen' : 'Choose'}</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.remove} onPress={() => removeFromCompare(r.id)} accessibilityRole="button" accessibilityLabel={`Remove ${r.name}`}>
                <Text style={styles.removeText}>Remove</Text>
              </AnimatedPressable>
            </View>
          ) : <View key={`empty-${i}`} style={styles.col} />)}
        </View>

        {rowOf('Each person pays a month', each)}
        {rowOf('Bills', (r) => <Text style={styles.cellText}>{r.bills_included === true ? 'Included' : billsLine(r).replace('Bills not included, about ', 'Not included, about ').replace('Bills not included', 'Not included').replace('Bills not confirmed yet', 'Not confirmed')}</Text>)}
        {rowOf('Deposit', (r) => {
          if (r.deposit_aed == null) return <Text style={styles.cellText}>None listed</Text>;
          const people = defaultPeople(r.bedrooms);
          return (
            <>
              <Text style={styles.bold}>{formatAedAmount(r.deposit_aed)}</Text>
              {isWholeHome(r) ? <Text style={styles.sub}>{formatAedAmount(Math.round(r.deposit_aed / people))} each</Text> : null}
            </>
          );
        })}
        {rowOf(myUniversity ? `To ${myUniversity}` : 'To campus', (r) => {
          const c = pickCommute(r, myUniversity);
          return c ? (
            <>
              <Text style={styles.bold}>{commuteText(c)}</Text>
              {c.university !== myUniversity ? <Text style={styles.sub}>{c.university}</Text> : null}
            </>
          ) : <Text style={styles.cellText}>Not listed</Text>;
        })}
        {rowOf('Kind of place', (r) => <Text style={styles.cellText}>{r.listing_type === 'home' && r.bedrooms ? `Whole home, ${r.bedrooms} bedrooms` : LISTING_TYPE_LABEL[r.listing_type]}</Text>)}
        {rowOf('Who it is for', (r) => <Text style={styles.cellText}>{GENDER_POLICY_LABEL[r.gender_policy]}</Text>)}
        {rowOf('Verified by Havenly', (r) => <Text style={styles.cellText}>{r.is_verified ? 'Yes' : 'Not yet'}</Text>)}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <PrimaryButton label="Enquire about the chosen place" disabled={!chosenId} onPress={enquire} />
        <Text style={styles.barNote}>
          {chosenId ? `You can compare up to ${MAX_COMPARE} places. Remove one to add another.` : 'Choose one place to enquire about it. You can compare up to 3 places.'}
        </Text>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 8 },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 30, letterSpacing: -0.6, color: colors.ink },
    count: { fontSize: 14, color: colors.inkSoft },
    row: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
    col: { flex: 1, minWidth: 0, gap: 6 },
    photo: { height: 80, borderRadius: 10, overflow: 'hidden', backgroundColor: '#DDD7CB' },
    colName: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 13, lineHeight: 17, color: colors.ink, minHeight: 34 },
    choose: { height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
    chooseOn: { backgroundColor: colors.coralFill, borderColor: colors.coralFill },
    chooseText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, color: colors.ink },
    remove: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    removeText: { fontSize: 14, color: colors.inkSoft, textDecorationLine: 'underline' },
    lbl: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase', color: colors.inkSoft, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
    cell: { flex: 1, minWidth: 0, minHeight: 44, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 9 },
    cellEmpty: { flex: 1, minWidth: 0 },
    cellText: { fontSize: 14, lineHeight: 18, color: colors.ink, fontVariant: ['tabular-nums'] },
    bold: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, lineHeight: 18, color: colors.ink, fontVariant: ['tabular-nums'] },
    sub: { fontSize: 12, lineHeight: 16, color: colors.inkSoft, marginTop: 2 },
    bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.line, paddingHorizontal: 16, paddingTop: 12 },
    barNote: { fontSize: 12, color: colors.inkMuted, textAlign: 'center', marginTop: 8 },
  });
}
