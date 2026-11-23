import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import PhotoPlaceholder from '@/components/PhotoPlaceholder';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { countForHome } from '@/lib/housematesApi';
import { formatCheckedDate } from '@/lib/trust';
import ActionSheet from '@/components/ActionSheet';
import { NOT_VERIFIED_LINE, VERIFIED_EXPLAINER, VERIFIED_TITLE } from '@/constants/rentingGuide';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { useRequireAccount } from '@/lib/requireAccount';
import { openInMaps } from '@/lib/maps';
import {
  amenityIcon, annualPrice, ENQUIRY_STATUS_LABEL, formatAed, GENDER_POLICY_LABEL, PERIOD_LABEL, setResidenceSaved,
} from '@/lib/housing';
import { LISTING_TYPE_LABEL } from '@/lib/listing';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import BurstHeart from '@/components/BurstHeart';
import Skeleton from '@/components/Skeleton';
import { BillsTag, DealTag, NotVerifiedTag, Notice, OutlineButton, PrimaryButton, StateBlock, VerifiedBadge } from '@/components/housing/parts';
import { MAX_COMPARE, addToCompare, removeFromCompare, useCompareIds } from '@/components/housing/compareStore';
import { billsLine, commuteText, housematesLine, isDeal, isWholeHome, moveInRows, priceInfo } from '@/components/housing/listingModel';
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { EnquiryStatus, Residence } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'ResidenceDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const HERO_HEIGHT = 300;

export default function ResidenceDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { residenceId } = route.params;
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const requireAccount = useRequireAccount();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;
  const compareIds = useCompareIds();

  const [residence, setResidence] = useState<Residence | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [openEnquiryStatus, setOpenEnquiryStatus] = useState<EnquiryStatus | null>(null);
  const [compareFull, setCompareFull] = useState(false);
  const [housemateCount, setHousemateCount] = useState(0);
  const [verifiedSheet, setVerifiedSheet] = useState(false);
  // Once the photo has scrolled away, a solid strip keeps the floating buttons readable.
  const [pastHero, setPastHero] = useState(false);

  const load = useCallback(async () => {
    try {
      const [residenceRes, savedRes, enquiryRes] = await Promise.all([
        supabase.from('residences').select('*, room_types(*)').eq('id', residenceId).maybeSingle(),
        myId
          ? supabase.from('saved_residences').select('residence_id').eq('user_id', myId).eq('residence_id', residenceId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        myId
          ? supabase.from('housing_enquiries').select('status').eq('user_id', myId).eq('residence_id', residenceId)
            .order('created_at', { ascending: false }).limit(1)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (residenceRes.error) throw residenceRes.error;
      const row = residenceRes.data as Residence | null;
      if (row?.room_types) {
        row.room_types = [...row.room_types].sort((a, b) => a.sort_order - b.sort_order || annualPrice(a) - annualPrice(b));
      }
      setResidence(row);
      // How many students are looking for housemates for this whole home (only for signed-in students).
      if (row?.listing_type === 'home' && myId) countForHome(residenceId).then(setHousemateCount);
      else setHousemateCount(0);
      setSaved(!!savedRes.data);
      setOpenEnquiryStatus(((enquiryRes.data as { status: EnquiryStatus }[]) ?? [])[0]?.status ?? null);
      setFailed(false);
    } catch {
      setFailed(true);
    }
    setLoaded(true);
  }, [residenceId, myId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleSaved = async () => {
    if (!requireAccount('save', residenceId)) return;
    if (!myId) return;
    const next = !saved;
    haptics.tap();
    setSaved(next);
    try {
      await setResidenceSaved(myId, residenceId, next);
    } catch {
      setSaved(!next);
      showToast('Couldn’t update your saved list. Try again.', 'error');
    }
  };

  const inCompare = compareIds.includes(residenceId);
  const toggleCompare = () => {
    if (!requireAccount('compare', residenceId)) return;
    if (inCompare) {
      removeFromCompare(residenceId);
      setCompareFull(false);
      return;
    }
    if (addToCompare(residenceId) === 'full') setCompareFull(true);
    else setCompareFull(false);
  };

  const enquire = () => {
    if (!requireAccount('enquire', residenceId)) return;
    navigation.navigate('HousingEnquiry', { residenceId, kind: 'viewing' });
  };

  const backButton = (
    <BackButton style={[styles.roundBtn, { top: insets.top + 12, left: 16 }]}>
      <Icon name="arrow-left" size={20} color="#1F1B16" />
    </BackButton>
  );

  if (!loaded) {
    return (
      <View style={styles.container} accessibilityLabel="Loading this place">
        {backButton}
        <Skeleton style={{ height: HERO_HEIGHT, borderRadius: 0 }} />
        <View style={styles.body}>
          <Skeleton style={{ height: 28, width: '70%' }} />
          <Skeleton style={{ height: 16, width: '45%', marginTop: 12 }} />
          <Skeleton style={{ height: 150, width: '100%', marginTop: 24, borderRadius: 14 }} />
        </View>
      </View>
    );
  }

  if (failed) {
    return (
      <View style={styles.container}>
        {backButton}
        <View style={{ marginTop: insets.top + 80 }}>
          <StateBlock
            icon="alert-circle" kind="error" title="We could not open this listing"
            body="It may have been removed, or your connection dropped. Go back to the results or try again."
            primary={{ label: 'Try again', onPress: () => { setLoaded(false); load(); } }}
            secondary={{ label: 'Back to results', onPress: () => navigation.goBack() }}
          />
        </View>
      </View>
    );
  }

  if (!residence) {
    return (
      <View style={styles.container}>
        {backButton}
        <View style={{ marginTop: insets.top + 80, paddingHorizontal: 16, gap: 8 }}>
          <Notice kind="note">This place is full or no longer listed.</Notice>
          <StateBlock
            icon="home" title="See similar places near your campus"
            body="Go back to the results to find another place."
            primary={{ label: 'Back to results', onPress: () => navigation.goBack() }}
          />
        </View>
      </View>
    );
  }

  const photos = residence.photo_urls;
  const heroPhoto = photos[photoIndex] ?? photos[0];
  const myUniversity = profile?.university ?? null;
  const rooms = residence.room_types ?? [];
  const hasAvailableRoom = rooms.some((r) => r.is_available);
  const unavailable = !residence.is_active || (rooms.length > 0 && !hasAvailableRoom);
  const { now, was } = priceInfo(residence);
  const move = moveInRows(residence);
  const home = isWholeHome(residence);
  const kindTitle = home && residence.bedrooms ? `Whole ${residence.bedrooms} bedroom home` : LISTING_TYPE_LABEL[residence.listing_type];
  const housemates = housematesLine(residence.housemates);
  const deal = isDeal(residence);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 190 }}
        scrollEventThrottle={32}
        onScroll={(e) => { const past = e.nativeEvent.contentOffset.y > HERO_HEIGHT - 90; setPastHero((cur) => (cur === past ? cur : past)); }}
      >
        <View style={styles.hero}>
          {heroPhoto ? (
            <Image source={{ uri: heroPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityLabel={`Photo ${photoIndex + 1} of ${residence.name}`} />
          ) : (
            <PhotoPlaceholder icon="home" style={StyleSheet.absoluteFill} />
          )}
          {photos.length > 0 ? (
            <View style={styles.countPill}><Text style={styles.countPillText}>{photoIndex + 1} / {photos.length}</Text></View>
          ) : null}
        </View>

        {photos.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
            {photos.map((url, i) => (
              <AnimatedPressable
                key={`${url}-${i}`}
                onPress={() => { haptics.tap(); setPhotoIndex(i); }}
                style={[styles.thumb, i === photoIndex && styles.thumbActive]}
                accessibilityRole="button"
                accessibilityLabel={`Show photo ${i + 1}`}
              >
                <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              </AnimatedPressable>
            ))}
          </ScrollView>
        )}

        <View style={styles.body}>
          {unavailable ? (
            <Notice kind="note" style={{ marginBottom: 16 }}>
              This place is full or no longer listed. You can still see its details below, but you cannot send an enquiry.
            </Notice>
          ) : null}

          <View style={styles.tagRow}>
            {residence.is_verified ? (
              <Pressable onPress={() => setVerifiedSheet(true)} accessibilityRole="button" accessibilityLabel="Verified by Havenly. What does this mean?" hitSlop={6}>
                <VerifiedBadge />
              </Pressable>
            ) : <NotVerifiedTag />}
            {residence.bills_included === true ? <BillsTag /> : null}
            {deal ? <DealTag /> : null}
          </View>
          {residence.is_verified ? (
            <Text style={styles.trustLine}>
              {formatCheckedDate(residence.verified_at) ? `Verified on ${formatCheckedDate(residence.verified_at)}. ` : ''}
              <Text style={styles.trustLink} onPress={() => setVerifiedSheet(true)} accessibilityRole="button">What does Verified mean?</Text>
            </Text>
          ) : (
            <Text style={styles.trustLine}>
              {NOT_VERIFIED_LINE}{' '}
              <Text style={styles.trustLink} onPress={() => navigation.navigate('Guide')} accessibilityRole="link">Read the renting guide</Text>
            </Text>
          )}

          <Text style={styles.name} accessibilityRole="header">{residence.name}</Text>
          <View style={styles.locRow}>
            <Icon name="map-pin" size={16} color={colors.inkSoft} />
            <Text style={styles.loc}>{residence.area}, Dubai</Text>
            <AnimatedPressable
              style={styles.mapsBtn}
              accessibilityRole="link"
              accessibilityLabel="Open in Maps"
              onPress={() => openInMaps({ label: residence.address ?? `${residence.name}, ${residence.area}, Dubai`, latitude: residence.latitude, longitude: residence.longitude })}
            >
              <Text style={styles.mapsText}>Open in Maps</Text>
            </AnimatedPressable>
          </View>

          <View style={styles.costBox}>
            <View style={styles.priceLine}>
              {now != null ? <Text style={styles.price}>{formatAed(now)}</Text> : <Text style={styles.priceMissing}>Price on request</Text>}
              {was != null ? <Text style={styles.was}>{formatAed(was)}</Text> : null}
              {now != null ? <Text style={styles.per}>{home ? 'per month for the whole home' : 'per month'}</Text> : null}
            </View>
            <Text style={styles.billsLine}>
              {billsLine(residence)}
              {deal && residence.student_rate_aed ? '. Student rate.' : ''}
            </Text>
            {move ? (
              <View style={styles.moveIn}>
                <Text style={styles.caps}>To move in</Text>
                <CostRow label="First month" value={formatAed(move.firstMonth)} styles={styles} />
                <CostRow label="Deposit" value={move.deposit != null ? formatAed(move.deposit) : 'None'} styles={styles} />
                <CostRow label="One-time fees" value={move.fees != null ? formatAed(move.fees) : 'None'} styles={styles} />
                <View style={[styles.costRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total to move in</Text>
                  <Text style={styles.totalValue}>{formatAed(move.total)}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.muted}>The price is not listed yet. Send an enquiry and the Havenly team will confirm it.</Text>
            )}
            {home ? <OutlineButton label="Split the rent" icon="users" onPress={() => navigation.navigate('SplitRent', { residenceId })} style={{ marginTop: 14 }} /> : null}
            {home ? (
              <View style={{ marginTop: 10, gap: 8 }}>
                <OutlineButton
                  label={housemateCount > 0 ? `${housemateCount} ${housemateCount === 1 ? 'student is' : 'students are'} looking for housemates here` : 'Find housemates for this home'}
                  icon="users"
                  onPress={() => { if (requireAccount('housemates', residenceId)) navigation.navigate(housemateCount > 0 ? 'HousemateBoard' : 'MyHousemateCard', { residenceId }); }}
                />
                {housemateCount > 0 ? (
                  <OutlineButton label="Look for housemates for this home myself" onPress={() => { if (requireAccount('housemates', residenceId)) navigation.navigate('MyHousemateCard', { residenceId }); }} />
                ) : null}
              </View>
            ) : null}
          </View>

          <OutlineButton
            label={inCompare ? 'Added to compare, tap to remove' : 'Add to compare'}
            icon={inCompare ? 'check' : 'plus'}
            onPress={toggleCompare}
            style={{ marginTop: 12 }}
          />
          {compareFull ? <Notice style={{ marginTop: 8 }}>You can compare up to {MAX_COMPARE} places. Remove one to add this one.</Notice> : null}

          {rooms.length > 0 && (
            <>
              <Text style={styles.h2}>Rooms</Text>
              {rooms.map((room) => (
                <View key={room.id} style={[styles.roomRow, !room.is_available && { opacity: 0.6 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roomName}>{room.name}</Text>
                    <Text style={styles.roomMeta}>
                      {room.occupancy === 1 ? 'Private room' : `Shared by ${room.occupancy} people`}{!room.is_available ? ', full' : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.roomPrice}>{formatAed(room.price_aed)}</Text>
                    <Text style={styles.roomPeriod}>per {PERIOD_LABEL[room.billing_period]}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {residence.commutes.length > 0 && (
            <>
              <Text style={styles.h2}>Getting to campus</Text>
              <View style={styles.card}>
                {residence.commutes.map((c, i) => (
                  <View key={c.university} style={[styles.costRow, i > 0 && styles.divider]}>
                    <Text style={[styles.rowLabel, { flex: 1 }, c.university === myUniversity && { fontFamily: 'HankenGrotesk_700Bold' }]}>{c.university}</Text>
                    <Text style={styles.rowValue}>{commuteText(c)}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.small}>Times are estimates from the Havenly team.</Text>
            </>
          )}

          <Text style={styles.h2}>The place</Text>
          <View style={styles.card}>
            <View style={styles.costRow}><Text style={styles.rowLabel}>Kind of place</Text><Text style={styles.rowValue}>{kindTitle}</Text></View>
            <View style={[styles.costRow, styles.divider]}><Text style={styles.rowLabel}>Who it is for</Text><Text style={styles.rowValue}>{GENDER_POLICY_LABEL[residence.gender_policy]}</Text></View>
            {housemates ? <View style={[styles.costRow, styles.divider]}><Text style={styles.rowLabel}>Flatmates</Text><Text style={styles.rowValue}>{housemates}</Text></View> : null}
          </View>

          {residence.amenities.length > 0 && (
            <View style={styles.amenityGrid}>
              {residence.amenities.map((a) => (
                <View key={a} style={styles.amenity}>
                  {amenityIcon(a) ? <Icon name={amenityIcon(a)!} size={15} color={colors.tintText} /> : null}
                  <Text style={styles.amenityText}>{a}</Text>
                </View>
              ))}
            </View>
          )}

          {residence.description ? <Text style={styles.description}>{residence.description}</Text> : null}

          <Text style={styles.provider}>Listed by {residence.provider_name}</Text>
          {residence.permit_number ? <Text style={styles.small}>Advert permit (Trakheesi) no. {residence.permit_number}</Text> : null}
          <Pressable onPress={() => navigation.navigate('Guide')} accessibilityRole="link" style={styles.guideLink}>
            <Icon name="book-open" size={16} color={colors.coral} />
            <Text style={styles.guideLinkText}>Before you pay: read the renting guide</Text>
          </Pressable>
        </View>
      </ScrollView>

      {pastHero ? (
        <View pointerEvents="none" style={[styles.strip, { height: insets.top + 68 }]}>
          <Text style={styles.stripTitle} numberOfLines={1}>{residence.name}</Text>
        </View>
      ) : null}
      {backButton}
      <ActionSheet
        visible={verifiedSheet}
        onClose={() => setVerifiedSheet(false)}
        title={VERIFIED_TITLE}
        message={VERIFIED_EXPLAINER}
        actions={[{ label: 'Read the renting guide', onPress: () => navigation.navigate('Guide') }]}
        cancelLabel="Got it"
      />
      <AnimatedPressable
        style={[styles.roundBtn, { top: insets.top + 12, right: 16 }]}
        scaleTo={0.92}
        onPress={toggleSaved}
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Remove from saved' : 'Save this place'}
      >
        <BurstHeart active={saved} size={20} color="#1F1B16" activeColor="#7A2433" />
      </AnimatedPressable>

      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 12 }]}>
        {openEnquiryStatus ? (
          <AnimatedPressable style={styles.enquiryStatusRow} onPress={() => navigation.navigate('MyEnquiries')} accessibilityRole="button">
            <Icon name="check-circle" size={16} color={colors.tintText} />
            <Text style={styles.enquiryStatusText}>You have enquired: {ENQUIRY_STATUS_LABEL[openEnquiryStatus]}</Text>
            <Icon name="chevron-right" size={14} color={colors.inkSoft} />
          </AnimatedPressable>
        ) : null}
        <View style={styles.ctaRow}>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.ctaPrice}>{now != null ? formatAed(now) : 'Price on request'}</Text>
            <Text style={styles.ctaPer}>{now != null ? (residence.bills_included === true ? 'per month, bills included' : 'per month') : ' '}</Text>
          </View>
          <PrimaryButton
            label={unavailable ? 'Currently full' : 'Enquire or book a viewing'}
            disabled={unavailable}
            onPress={enquire}
            style={{ flex: 1 }}
          />
        </View>
        {!myId ? <Text style={styles.ctaNote}>You make a free account when you send this.</Text> : null}
      </View>
    </View>
  );
}

function CostRow({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.costRow}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    roundBtn: { position: 'absolute', zIndex: 2, width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    strip: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, backgroundColor: colors.sand, borderBottomWidth: 1, borderColor: colors.line, justifyContent: 'flex-end', paddingBottom: 14, paddingHorizontal: 72 },
    stripTitle: { fontFamily: 'SchibstedGrotesk_600SemiBold', fontSize: 16, color: colors.ink, textAlign: 'center' },
    hero: { height: HERO_HEIGHT, overflow: 'hidden', backgroundColor: '#DDD7CB' },
    countPill: { position: 'absolute', right: 12, bottom: 12, backgroundColor: '#1F1B16', paddingHorizontal: 10, minHeight: 28, borderRadius: 8, justifyContent: 'center' },
    countPillText: { color: '#FFFFFF', fontFamily: 'HankenGrotesk_700Bold', fontSize: 13 },
    thumbRow: { gap: 8, paddingHorizontal: 16, paddingTop: 12 },
    thumb: { width: 76, height: 56, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: '#DDD7CB' },
    thumbActive: { borderColor: colors.coral },
    body: { padding: spacing.md + 4, paddingTop: 16 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    name: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 27, lineHeight: 30, letterSpacing: -0.4, color: colors.ink, marginTop: 14 },
    locRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
    loc: { fontSize: 15, color: colors.inkBody },
    mapsBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
    mapsText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, color: colors.coral, textDecorationLine: 'underline' },
    costBox: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 16, marginTop: 8 },
    priceLine: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 8 },
    price: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 34, color: colors.ink },
    priceMissing: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 24, color: colors.ink },
    was: { fontSize: 16, color: colors.inkSoft, textDecorationLine: 'line-through' },
    per: { fontSize: 15, color: colors.inkSoft },
    billsLine: { fontSize: 14, lineHeight: 20, color: colors.inkBody, marginTop: 6 },
    moveIn: { marginTop: 14, borderTopWidth: 1, borderColor: colors.line, paddingTop: 12 },
    caps: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 12, letterSpacing: 0.72, textTransform: 'uppercase', color: colors.inkSoft, marginBottom: 4 },
    costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 36 },
    divider: { borderTopWidth: 1, borderColor: '#E8E3D9' },
    rowLabel: { fontSize: 15, color: colors.inkBody },
    rowValue: { fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'], textAlign: 'right', flexShrink: 1 },
    totalRow: { borderTopWidth: 1, borderColor: colors.line, marginTop: 6, paddingTop: 8 },
    totalLabel: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 16, color: colors.ink },
    totalValue: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
    muted: { fontSize: 14, lineHeight: 20, color: colors.inkBody, marginTop: 12 },
    h2: { fontFamily: 'SchibstedGrotesk_600SemiBold', fontSize: 19, color: colors.ink, marginTop: 28, marginBottom: 10 },
    card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4 },
    trustLine: { fontSize: 13.5, lineHeight: 19, color: colors.inkSoft, marginTop: 10 },
    trustLink: { color: colors.coral, fontWeight: '700', textDecorationLine: 'underline' },
    guideLink: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 14 },
    guideLinkText: { fontSize: 15, fontWeight: '700', color: colors.coral },
    small: { fontSize: 13, color: colors.inkMuted, marginTop: 8 },
    roomRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14, marginBottom: 8 },
    roomName: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 15, color: colors.ink },
    roomMeta: { fontSize: 13, color: colors.inkBody, marginTop: 2 },
    roomPrice: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
    roomPeriod: { fontSize: 12, color: colors.inkMuted },
    amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    amenity: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.tintBg, paddingHorizontal: 10, minHeight: 32, borderRadius: 8 },
    amenityText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.tintText },
    description: { fontSize: 15, lineHeight: 22, color: colors.inkBody, marginTop: 16 },
    provider: { fontSize: 14, color: colors.inkBody, marginTop: 20 },
    ctaBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.line, paddingHorizontal: 16, paddingTop: 12 },
    enquiryStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
    enquiryStatusText: { flex: 1, fontSize: 14, fontFamily: 'HankenGrotesk_600SemiBold', color: colors.ink },
    ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    ctaPrice: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 18, color: colors.ink },
    ctaPer: { fontSize: 12, color: colors.inkMuted },
    ctaNote: { fontSize: 12, color: colors.inkMuted, textAlign: 'center', marginTop: 8 },
  });
}
