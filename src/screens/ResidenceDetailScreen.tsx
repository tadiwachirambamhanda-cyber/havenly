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
import { defaultPeople, MAX_PEOPLE, MIN_PEOPLE } from '@/lib/rentSplit';
import {
  answersLabel, fetchAreaPosts, initialAreaState, postByline, type AreaPostsClient, type AreaPostsState,
} from '@/lib/areaPosts';
import {
  amenityIcon, annualPrice, ENQUIRY_STATUS_LABEL, formatAed, GENDER_POLICY_LABEL, PERIOD_LABEL, setResidenceSaved,
} from '@/lib/housing';
import { LISTING_TYPE_LABEL } from '@/lib/listing';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import BurstHeart from '@/components/BurstHeart';
import Skeleton from '@/components/Skeleton';
import {
  CARD_RADIUS, DealTag, NotVerifiedTag, Notice, SampleTag, OutlineButton, PrimaryButton, StateBlock, TextButton, VerifiedBadge,
} from '@/components/housing/parts';
import { billsLine, commuteText, housematesLine, isDeal, isWholeHome, moveInRows, priceInfo, splitPanel } from '@/components/housing/listingModel';
import type { ColorTokens } from '@/theme/tokens';
import type { EnquiryStatus, Residence } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'ResidenceDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const HERO_HEIGHT = 320;

export default function ResidenceDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { residenceId } = route.params;
  const insets = useSafeAreaInsets();
  const { session, profile, isGuest } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const requireAccount = useRequireAccount();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;

  const [residence, setResidence] = useState<Residence | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [heroWidth, setHeroWidth] = useState(0);
  const [openEnquiryStatus, setOpenEnquiryStatus] = useState<EnquiryStatus | null>(null);
  const [housemateCount, setHousemateCount] = useState(0);
  const [verifiedSheet, setVerifiedSheet] = useState(false);
  // null until the student changes it: then the default follows the number of bedrooms.
  const [people, setPeople] = useState<number | null>(null);
  const [area, setArea] = useState<AreaPostsState>(() => initialAreaState({ signedIn: !!myId, isGuest }));
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

  // "Students talking about this area": only signed-in students can read posts; a demo guest
  // never reaches the database for them.
  const loadAreaPosts = useCallback(async () => {
    const start = initialAreaState({ signedIn: !!myId, isGuest });
    setArea(start);
    if (start.kind !== 'loading') return;
    try {
      const posts = await fetchAreaPosts(supabase as unknown as AreaPostsClient, residenceId);
      setArea({ kind: 'posts', posts });
    } catch {
      setArea({ kind: 'failed' });
    }
  }, [myId, isGuest, residenceId]);

  // Refreshes on every visit, so a question asked from here shows when the student comes back.
  useFocusEffect(useCallback(() => { loadAreaPosts(); }, [loadAreaPosts]));

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

  const enquire = () => {
    if (!requireAccount('enquire', residenceId)) return;
    navigation.navigate('HousingEnquiry', { residenceId, kind: 'viewing' });
  };

  const backButton = (
    <BackButton style={[styles.roundBtn, { top: insets.top + 12, left: 16 }]}>
      <Icon name="arrow-left" size={18} color={colors.ink} />
    </BackButton>
  );

  if (!loaded) {
    return (
      <View style={styles.container} accessibilityLabel="Loading this place">
        {backButton}
        <Skeleton style={{ height: HERO_HEIGHT, borderRadius: 0 }} />
        <View style={styles.sheet}>
          <Skeleton style={{ height: 28, width: '70%' }} />
          <Skeleton style={{ height: 16, width: '45%', marginTop: 12 }} />
          <Skeleton style={{ height: 200, width: '100%', marginTop: 24, borderRadius: CARD_RADIUS }} />
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
        <View style={{ marginTop: insets.top + 80, paddingHorizontal: 20, gap: 8 }}>
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
  const count = people ?? defaultPeople(residence.bedrooms);
  const split = splitPanel(residence, count);

  const stepper = (delta: -1 | 1) => {
    const next = count + delta;
    const off = next < MIN_PEOPLE || next > MAX_PEOPLE;
    return (
      <AnimatedPressable
        style={[styles.stepBtn, off && { opacity: 0.35 }]}
        disabled={off}
        onPress={() => { haptics.tap(); setPeople(next); }}
        accessibilityRole="button"
        accessibilityLabel={delta < 0 ? 'One person fewer' : 'One person more'}
      >
        <Text style={styles.stepGlyph}>{delta < 0 ? '−' : '+'}</Text>
      </AnimatedPressable>
    );
  };

  const askAbout = () => navigation.navigate('CreatePost', { area: residence.area });

  let areaBody: React.ReactNode;
  if (area.kind === 'signed_out') {
    areaBody = (
      <Pressable
        onPress={() => navigation.navigate('SignInToContinue', { reason: 'login', residenceId })}
        accessibilityRole="link"
        style={styles.areaSignIn}
      >
        <Icon name="message-circle" size={18} color={colors.mintText} />
        <Text style={styles.areaSignInText}>Sign in to read what students say about {residence.area}.</Text>
      </Pressable>
    );
  } else if (area.kind === 'loading') {
    areaBody = (
      <View style={{ gap: 10 }} accessibilityLabel="Loading posts">
        <Skeleton style={{ height: 96, borderRadius: 20 }} />
        <Skeleton style={{ height: 96, borderRadius: 20 }} />
      </View>
    );
  } else {
    areaBody = (
      <>
        {area.kind === 'failed' ? (
          <View style={styles.areaFailed}>
            <Text style={styles.areaFailedText}>We could not load what students say.</Text>
            <TextButton label="Try again" onPress={loadAreaPosts} />
          </View>
        ) : null}
        {area.kind === 'posts' ? area.posts.map((p) => (
          <AnimatedPressable
            key={p.id}
            style={styles.postCard}
            scaleTo={0.99}
            onPress={() => navigation.navigate('PostDetail', { postId: p.id })}
            accessibilityRole="button"
            accessibilityLabel={`${postByline(p)}. ${p.body}. ${answersLabel(p.answers)}`}
          >
            <Text style={styles.postBy}>{postByline(p)}</Text>
            <Text style={styles.postBody} numberOfLines={4}>{p.body}</Text>
            <Text style={styles.postAnswers}>{answersLabel(p.answers)}</Text>
          </AnimatedPressable>
        )) : null}
        <TextButton label={`Ask about ${residence.area}`} onPress={askAbout} />
      </>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: (home ? 200 : 150) + insets.bottom }}
        scrollEventThrottle={32}
        onScroll={(e) => { const past = e.nativeEvent.contentOffset.y > HERO_HEIGHT - 90; setPastHero((cur) => (cur === past ? cur : past)); }}
      >
        <View style={styles.hero} onLayout={(e) => setHeroWidth(e.nativeEvent.layout.width)}>
          {photos.length > 0 && heroWidth > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={32}
              onScroll={(e) => {
                const i = Math.round(e.nativeEvent.contentOffset.x / heroWidth);
                setPhotoIndex((cur) => (cur === i ? cur : Math.max(0, Math.min(photos.length - 1, i))));
              }}
            >
              {photos.map((url, i) => (
                <Image
                  key={`${url}-${i}`}
                  source={{ uri: url }}
                  style={{ width: heroWidth, height: HERO_HEIGHT }}
                  contentFit="cover"
                  transition={200}
                  accessibilityLabel={`Photo ${i + 1} of ${photos.length}, ${residence.name}`}
                />
              ))}
            </ScrollView>
          ) : photos.length === 0 ? (
            <PhotoPlaceholder icon="home" style={StyleSheet.absoluteFill} />
          ) : null}
          {photos.length > 0 ? (
            <View style={styles.countPill} pointerEvents="none"><Text style={styles.countPillText}>{photoIndex + 1} / {photos.length}</Text></View>
          ) : null}
        </View>

        <View style={styles.sheet}>
          {unavailable ? (
            <Notice kind="note">
              This place is full or no longer listed. You can still see its details below, but you cannot send an enquiry.
            </Notice>
          ) : null}

          <View style={{ gap: 8 }}>
            <View style={styles.tagRow}>
              {residence.is_sample ? <SampleTag /> : null}
              {residence.is_sample ? null : residence.is_verified ? (
                <Pressable onPress={() => setVerifiedSheet(true)} accessibilityRole="button" accessibilityLabel="Verified by Havenly. What does this mean?" hitSlop={8}>
                  <VerifiedBadge />
                </Pressable>
              ) : <NotVerifiedTag />}
              {deal ? <DealTag /> : null}
            </View>
            <Text style={styles.name} accessibilityRole="header">{residence.name}</Text>
            <Text style={styles.loc}>{kindTitle} · {residence.area}, Dubai</Text>
            {residence.is_verified ? (
              <Text style={styles.trustLine}>
                {formatCheckedDate(residence.verified_at) ? `Verified on ${formatCheckedDate(residence.verified_at)}. ` : ''}
                <Text style={styles.trustLink} onPress={() => setVerifiedSheet(true)} accessibilityRole="button">What does Verified mean?</Text>
              </Text>
            ) : (
              <Text style={styles.trustLine}>{NOT_VERIFIED_LINE}</Text>
            )}
          </View>

          <View style={styles.costCard}>
            <View style={styles.priceLine}>
              {now != null ? <Text style={styles.price}>{formatAed(now)}</Text> : <Text style={styles.priceMissing}>Price on request</Text>}
              {now != null ? <Text style={styles.per}>{home ? 'per month for the home' : 'per month'}</Text> : null}
              {was != null ? <Text style={styles.was}>{formatAed(was)}</Text> : null}
            </View>
            <Text style={styles.billsLine}>
              {billsLine(residence)}
              {deal && residence.student_rate_aed ? '. Student rate.' : ''}
            </Text>

            {split ? (
              <View style={styles.splitPanel} accessibilityLiveRegion="polite">
                <View style={styles.splitTop}>
                  <Text style={styles.splitLabel}>Split between</Text>
                  <View style={styles.stepper}>
                    {stepper(-1)}
                    <Text style={styles.stepCount} accessibilityLabel={`Split between ${split.peopleLabel}`}>{split.peopleLabel}</Text>
                    {stepper(1)}
                  </View>
                </View>
                <Text style={styles.splitEach}>{split.each}</Text>
                <Text style={styles.splitNote}>{split.note}</Text>
              </View>
            ) : null}

            {move ? (
              <View style={styles.moveIn}>
                <Text style={styles.moveTitle}>To move in</Text>
                <CostRow label="First month" value={formatAed(move.firstMonth)} styles={styles} />
                <CostRow label="Deposit" value={move.deposit != null ? formatAed(move.deposit) : 'None'} styles={styles} />
                {move.fees != null ? <CostRow label="One-time fees" value={formatAed(move.fees)} styles={styles} /> : null}
                <View style={[styles.costRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total before you move in</Text>
                  <Text style={styles.totalValue}>{formatAed(move.total)}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.muted}>The price is not listed yet. Send an enquiry and the Havenly team will confirm it.</Text>
            )}
          </View>
          <TextButton label="Before you pay: read the renting guide" icon="book-open" onPress={() => navigation.navigate('Guide')} />

          {home ? (
            <View style={{ gap: 8 }}>
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

          <View style={styles.section}>
            <Text style={styles.h2}>Getting to campus</Text>
            {residence.commutes.map((c) => (
              <View key={c.university} style={styles.commuteRow}>
                <View style={styles.commuteIcon}><Icon name="bus" size={17} color={colors.coral} /></View>
                <Text style={styles.commuteText}>
                  <Text style={styles.strong}>{commuteText(c)}</Text> to {c.university}{c.university === myUniversity ? ' (your university)' : ''}
                </Text>
              </View>
            ))}
            {residence.commutes.length > 0 ? <Text style={styles.small}>Times are estimates from the Havenly team.</Text> : null}
            <TextButton
              label="Open in Maps"
              icon="map-pin"
              onPress={() => openInMaps({ label: residence.address ?? `${residence.name}, ${residence.area}, Dubai`, latitude: residence.latitude, longitude: residence.longitude })}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.h2}>Students talking about this area</Text>
            {areaBody}
          </View>

          {rooms.length > 0 && (
            <View style={styles.section}>
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
            </View>
          )}

          <View style={styles.section}>
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
          </View>
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
        actions={[]}
        cancelLabel="Got it"
      />
      <AnimatedPressable
        style={[styles.roundBtn, { top: insets.top + 12, right: 16 }]}
        scaleTo={0.92}
        onPress={toggleSaved}
        accessibilityRole="button"
        accessibilityLabel={saved ? 'Remove from saved' : 'Save this place'}
      >
        <BurstHeart active={saved} size={20} color={colors.coral} activeColor={colors.coral} />
      </AnimatedPressable>

      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 16 }]}>
        {openEnquiryStatus ? (
          <AnimatedPressable style={styles.enquiryStatusRow} onPress={() => navigation.navigate('MyEnquiries')} accessibilityRole="button">
            <Icon name="check-circle" size={16} color={colors.mintText} />
            <Text style={styles.enquiryStatusText}>You have enquired: {ENQUIRY_STATUS_LABEL[openEnquiryStatus]}</Text>
            <Icon name="chevron-right" size={14} color={colors.inkSoft} />
          </AnimatedPressable>
        ) : null}
        {residence?.is_sample ? (
          <Notice kind="note">This is a sample listing to show how Havenly works, so enquiries are off. Real places are on their way.</Notice>
        ) : (
          <PrimaryButton
            label={unavailable ? 'Currently full' : 'Enquire or book a viewing'}
            disabled={unavailable}
            onPress={enquire}
          />
        )}
        {home && !unavailable && !residence?.is_sample ? (
          <TextButton
            label="Enquire with friends"
            icon="users"
            color={colors.ink}
            style={{ alignSelf: 'center' }}
            onPress={() => { if (requireAccount('enquire', residenceId)) navigation.navigate('StartGroup', { residenceId }); }}
          />
        ) : null}
        {!myId && !residence?.is_sample ? <Text style={styles.ctaNote}>You make a free account when you send this.</Text> : null}
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
    roundBtn: { position: 'absolute', zIndex: 2, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
    strip: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, backgroundColor: colors.sand, borderBottomWidth: 1, borderColor: colors.line, justifyContent: 'flex-end', paddingBottom: 14, paddingHorizontal: 72 },
    stripTitle: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 16, color: colors.ink, textAlign: 'center' },
    hero: { height: HERO_HEIGHT, overflow: 'hidden', backgroundColor: colors.photo },
    countPill: { position: 'absolute', right: 16, bottom: 38, backgroundColor: 'rgba(28,20,24,0.72)', paddingHorizontal: 10, minHeight: 26, borderRadius: 13, justifyContent: 'center' },
    countPillText: { color: '#FFFFFF', fontFamily: 'HankenGrotesk_700Bold', fontSize: 12 },
    sheet: { marginTop: -24, backgroundColor: colors.sand, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 22, gap: 18 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    name: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 27, lineHeight: 30, letterSpacing: -0.6, color: colors.ink },
    loc: { fontSize: 14, color: colors.inkSoft },
    trustLine: { fontSize: 13.5, lineHeight: 19, color: colors.inkSoft },
    trustLink: { color: colors.coral, fontFamily: 'HankenGrotesk_700Bold', textDecorationLine: 'underline' },
    costCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: CARD_RADIUS, padding: 16, gap: 12 },
    priceLine: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6 },
    price: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 26, letterSpacing: -0.5, color: colors.ink },
    priceMissing: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 22, color: colors.ink },
    was: { fontSize: 14, color: colors.inkSoft, textDecorationLine: 'line-through' },
    per: { fontFamily: 'HankenGrotesk_500Medium', fontSize: 14, color: colors.inkSoft },
    billsLine: { fontSize: 14, lineHeight: 20, color: colors.ink },
    splitPanel: { backgroundColor: colors.mintBg, borderRadius: 18, padding: 14, gap: 10 },
    splitTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    splitLabel: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, color: colors.mintText },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.white, borderRadius: 24, padding: 2 },
    stepBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    stepGlyph: { fontFamily: 'HankenGrotesk_800ExtraBold', fontSize: 20, color: colors.ink, lineHeight: 24 },
    stepCount: { minWidth: 74, textAlign: 'center', fontFamily: 'HankenGrotesk_800ExtraBold', fontSize: 15, color: colors.ink },
    splitEach: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 22, lineHeight: 27, letterSpacing: -0.3, color: colors.mintText },
    splitNote: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, lineHeight: 18, color: colors.mintText },
    moveIn: { gap: 2 },
    moveTitle: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 15, color: colors.ink, marginBottom: 2 },
    costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, minHeight: 32 },
    divider: { borderTopWidth: 1, borderColor: colors.line },
    rowLabel: { fontSize: 14, color: colors.inkSoft },
    rowValue: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'], textAlign: 'right', flexShrink: 1 },
    totalRow: { borderTopWidth: 1, borderColor: colors.line, marginTop: 6, paddingTop: 8 },
    totalLabel: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 15, color: colors.ink },
    totalValue: { fontFamily: 'HankenGrotesk_800ExtraBold', fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
    muted: { fontSize: 14, lineHeight: 20, color: colors.inkBody },
    section: { gap: 10 },
    h2: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 19, letterSpacing: -0.3, color: colors.ink },
    commuteRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    commuteIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center' },
    commuteText: { flex: 1, fontSize: 14, lineHeight: 19, color: colors.ink },
    strong: { fontFamily: 'HankenGrotesk_700Bold' },
    areaSignIn: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.mintBg },
    areaSignInText: { flex: 1, fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, color: colors.mintText },
    areaFailed: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    areaFailedText: { fontSize: 14, color: colors.inkSoft },
    postCard: { gap: 6, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
    postBy: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.inkSoft },
    postBody: { fontSize: 15, lineHeight: 21, color: colors.ink },
    postAnswers: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 13, color: colors.mintText },
    card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: CARD_RADIUS, paddingHorizontal: 16, paddingVertical: 6 },
    small: { fontSize: 13, color: colors.inkMuted },
    roomRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14 },
    roomName: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 15, color: colors.ink },
    roomMeta: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
    roomPrice: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
    roomPeriod: { fontSize: 12, color: colors.inkMuted },
    amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    amenity: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.tintBg, paddingHorizontal: 12, minHeight: 32, borderRadius: 16 },
    amenityText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 13, color: colors.tintText },
    description: { fontSize: 15, lineHeight: 22, color: colors.inkBody },
    provider: { fontSize: 14, color: colors.inkSoft },
    ctaBar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.white, borderTopWidth: 1, borderColor: colors.line, paddingHorizontal: 16, paddingTop: 12, gap: 4 },
    enquiryStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
    enquiryStatusText: { flex: 1, fontSize: 14, fontFamily: 'HankenGrotesk_600SemiBold', color: colors.ink },
    ctaNote: { fontSize: 12, color: colors.inkMuted, textAlign: 'center', marginTop: 4 },
  });
}
