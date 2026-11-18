import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from '@/components/Text';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedPressable from '@/components/AnimatedPressable';
import Skeleton from '@/components/Skeleton';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { useRequireAccount } from '@/lib/requireAccount';
import { defaultPeople, formatAedAmount, formatAedRange, MAX_PEOPLE, MIN_PEOPLE, splitRent } from '@/lib/rentSplit';
import { LISTING_TYPE_LABEL } from '@/lib/listing';
import { Notice, PrimaryButton, SheetHeader, StateBlock } from '@/components/housing/parts';
import { billsInputOf, priceInfo } from '@/components/housing/listingModel';
import type { ColorTokens } from '@/theme/tokens';
import type { Residence } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'SplitRent'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SplitRentScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { residenceId } = route.params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const requireAccount = useRequireAccount();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [residence, setResidence] = useState<Residence | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [people, setPeople] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('residences').select('*, room_types(*)').eq('id', residenceId).maybeSingle();
      if (error) throw error;
      setResidence(data as Residence | null);
      setFailed(false);
    } catch {
      setFailed(true);
    }
    setLoaded(true);
  }, [residenceId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const close = () => navigation.goBack();
  const enquire = () => {
    if (!requireAccount('enquire', residenceId)) return;
    navigation.navigate('HousingEnquiry', { residenceId, kind: 'viewing' });
  };

  const shell = (children: React.ReactNode) => (
    <View style={styles.container}>
      <View style={styles.sheet}>
        <SheetHeader title="Split the rent" onClose={close} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 14 }}>{children}</ScrollView>
      </View>
    </View>
  );

  if (!loaded) {
    return shell(
      <View style={{ gap: 12 }} accessibilityLabel="Loading">
        <Skeleton style={{ height: 24, width: '70%' }} />
        <Skeleton style={{ height: 110, borderRadius: 14 }} />
        <Skeleton style={{ height: 60, borderRadius: 14 }} />
      </View>,
    );
  }
  if (failed) {
    return shell(
      <StateBlock icon="alert-circle" kind="error" title="We could not open this listing" body="Check your connection and try again."
        primary={{ label: 'Try again', onPress: () => { setLoaded(false); load(); } }} />,
    );
  }
  if (!residence) {
    return shell(<Notice kind="note">This place is full or no longer listed.</Notice>);
  }

  const count = people ?? defaultPeople(residence.bedrooms);
  const rent = priceInfo(residence).now;
  const title = residence.listing_type === 'home' && residence.bedrooms
    ? `Whole ${residence.bedrooms} bedroom home, ${residence.area}`
    : `${LISTING_TYPE_LABEL[residence.listing_type]}, ${residence.area}`;
  const split = rent == null
    ? null
    : splitRent({ rentAed: rent, depositAed: residence.deposit_aed, feesAed: residence.move_in_fee_aed, bills: billsInputOf(residence), people: count });

  if (!split || rent == null) {
    return shell(
      <>
        <Text style={styles.sub}>{title}</Text>
        <View style={styles.errBlock}>
          <Notice>We cannot split this one yet</Notice>
          <Text style={styles.body}>The price for this home is missing. Send an enquiry and the Havenly team will confirm it.</Text>
        </View>
        <PrimaryButton label="Enquire about this home" onPress={enquire} />
      </>,
    );
  }

  const billsIncluded = split.bills.kind === 'included';
  const eachText = formatAedRange(split.monthlyEachMin, split.monthlyEachMax);
  const approx = (v: number, isApprox: boolean) => `${isApprox ? 'about ' : ''}${formatAedAmount(v)}`;

  return shell(
    <>
      <Text style={styles.sub}>{title}</Text>

      <View style={styles.panel} accessibilityLiveRegion="polite">
        <Text style={styles.caps}>Each person pays</Text>
        <Text style={styles.big}>{eachText}</Text>
        <Text style={styles.panelSub}>
          {billsIncluded ? 'a month, bills included' : split.bills.kind === 'range' ? 'a month, rent and estimated bills worked out for you' : 'a month in rent. Bills are not listed yet.'}
        </Text>
      </View>

      <View>
        <Text style={styles.h}>How many people share?</Text>
        <View style={styles.stepRow}>
          <AnimatedPressable
            style={[styles.stepBtn, count <= MIN_PEOPLE && { opacity: 0.4 }]} disabled={count <= MIN_PEOPLE}
            onPress={() => setPeople(count - 1)} accessibilityRole="button" accessibilityLabel="One fewer person"
          >
            <Text style={styles.stepGlyph}>−</Text>
          </AnimatedPressable>
          <Text style={styles.count} accessibilityLabel={`${count} people`}>{count}</Text>
          <AnimatedPressable
            style={[styles.stepBtn, count >= MAX_PEOPLE && { opacity: 0.4 }]} disabled={count >= MAX_PEOPLE}
            onPress={() => setPeople(count + 1)} accessibilityRole="button" accessibilityLabel="One more person"
          >
            <Text style={styles.stepGlyph}>+</Text>
          </AnimatedPressable>
        </View>
        {residence.bedrooms ? <Text style={styles.hint}>A {residence.bedrooms} bedroom home usually suits {residence.bedrooms}</Text> : null}
      </View>

      <View style={styles.card}>
        <Row label={`Rent ${formatAedAmount(rent)} split ${count} ways`} value={formatAedAmount(split.rentEach)} styles={styles} />
        {split.bills.kind === 'included' ? <Row label="Bills" value="Included" styles={styles} divider /> : null}
        {split.bills.kind === 'range' ? (
          <Row
            label={`Bills, estimated ${formatAedRange(residence.bills_min_aed ?? 0, residence.bills_max_aed ?? 0)} for the home, split ${count} ways`}
            value={formatAedRange(split.bills.minEach, split.bills.maxEach)} styles={styles} divider
          />
        ) : null}
        {split.bills.kind === 'unknown' ? <Row label="Bills" value="Not listed yet" styles={styles} divider /> : null}
        <Row label="Per person, a month" value={eachText} styles={styles} divider strong />
        {split.depositEach != null && residence.deposit_aed != null ? (
          <Row label={`Deposit ${formatAedAmount(residence.deposit_aed)} split ${count} ways`} value={approx(split.depositEach, split.depositEachApprox)} styles={styles} divider />
        ) : null}
        {split.feesEach != null && residence.move_in_fee_aed != null ? (
          <Row label={`One-time fees ${formatAedAmount(residence.move_in_fee_aed)} split ${count} ways`} value={approx(split.feesEach, split.feesEachApprox)} styles={styles} divider />
        ) : null}
      </View>

      <Text style={styles.small}>
        Equal split only. You and your flatmates agree how to share it between you.{split.bills.kind === 'range' ? ' Bills are an estimate from the Havenly team.' : ''}
      </Text>

      <PrimaryButton label="Enquire about this home" onPress={enquire} />
    </>,
  );
}

function Row({ label, value, styles, divider, strong }: { label: string; value: string; styles: ReturnType<typeof createStyles>; divider?: boolean; strong?: boolean }) {
  return (
    <View style={[styles.row, divider && styles.divider]}>
      <Text style={[styles.rowLabel, strong && styles.strong]}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: '#7A756B', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.sand, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '94%', width: '100%' },
    sub: { fontSize: 15, color: colors.inkBody },
    body: { fontSize: 14, lineHeight: 20, color: colors.inkBody },
    errBlock: { gap: 10 },
    panel: { backgroundColor: colors.coralSoft, borderRadius: 14, padding: 16 },
    caps: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase', color: colors.tintText },
    big: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 28, color: colors.ink, marginTop: 4 },
    panelSub: { fontSize: 14, color: colors.tintText, marginTop: 2 },
    h: { fontFamily: 'SchibstedGrotesk_600SemiBold', fontSize: 19, color: colors.ink, marginBottom: 8 },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    stepBtn: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
    stepGlyph: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 24, color: colors.ink, lineHeight: 28 },
    count: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 30, color: colors.ink, minWidth: 36, textAlign: 'center' },
    hint: { fontSize: 13, color: colors.inkMuted, marginTop: 8 },
    card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 14 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
    divider: { borderTopWidth: 1, borderColor: '#E8E3D9' },
    rowLabel: { flex: 1, fontSize: 14, lineHeight: 19, color: colors.inkBody },
    rowValue: { fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'], textAlign: 'right', maxWidth: '45%' },
    strong: { fontFamily: 'HankenGrotesk_700Bold', color: colors.ink },
    small: { fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  });
}
