import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Text';
import Animated from 'react-native-reanimated';
import { useRoute, RouteProp } from '@react-navigation/native';
import BackButton from '@/components/BackButton';
import { Image } from 'expo-image';
import InitialsAvatar from '@/components/InitialsAvatar';
import PhotoPlaceholder from '@/components/PhotoPlaceholder';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { createCheckIn, deleteCheckIn, sendPing } from '@/lib/checkIns';
import { toggleInterest } from '@/lib/interests';
import { useParallaxHero } from '@/lib/animations';
import AnimatedPressable from '@/components/AnimatedPressable';
import Skeleton from '@/components/Skeleton';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { CheckIn, PlaceInterest, Offer, Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type VisibleCheckIn = CheckIn & { user: Profile };
type VisibleInterest = PlaceInterest & { user: Profile };

type Route = RouteProp<RootStackParamList, 'OfferDetail'>;

const HERO_HEIGHT = 220;

export default function OfferDetailScreen() {
  const route = useRoute<Route>();
  const { offerId } = route.params;
  const { profile, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { onScroll, heroAnimatedStyle, heroDimStyle } = useParallaxHero(HERO_HEIGHT);

  const [offer, setOffer] = useState<Offer | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimCode, setClaimCode] = useState<string | null>(null);
  const [checkIns, setCheckIns] = useState<VisibleCheckIn[]>([]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [interests, setInterests] = useState<VisibleInterest[]>([]);
  const [togglingInterest, setTogglingInterest] = useState(false);

  const load = useCallback(async () => {
    const now = new Date().toISOString();
    const [{ data: offerData }, { data: claimData }, { data: checkInData }, { data: interestData }] = await Promise.all([
      supabase.from('offers').select('*, brand:brands(*)').eq('id', offerId).maybeSingle(),
      profile
        ? supabase.from('offer_claims').select('code').eq('offer_id', offerId).eq('user_id', profile.id).maybeSingle()
        : Promise.resolve({ data: null as { code: string } | null }),
      supabase.from('check_ins').select('*, user:profiles(*)').eq('place_type', 'offer').eq('place_id', offerId).gt('expires_at', now),
      supabase.from('interests').select('*, user:profiles(*)').eq('place_type', 'offer').eq('place_id', offerId),
    ]);
    setOffer(offerData as unknown as Offer);
    setClaimCode(claimData?.code ?? null);
    setCheckIns((checkInData as unknown as VisibleCheckIn[]) ?? []);
    setInterests((interestData as unknown as VisibleInterest[]) ?? []);
    setLoaded(true);
  }, [offerId, profile]);

  useEffect(() => { load(); }, [load]);

  const myCheckIn = checkIns.find((c) => c.user_id === profile?.id) ?? null;
  const myInterest = interests.find((i) => i.user_id === profile?.id) ?? null;

  const toggleGoing = async () => {
    if (!profile || togglingInterest) return;
    setTogglingInterest(true);
    haptics.tap();
    try {
      await toggleInterest('offer', offerId);
      await load();
    } catch {
      showToast('Couldn’t update. Try again.', 'error');
    } finally {
      setTogglingInterest(false);
    }
  };

  const toggleCheckIn = async () => {
    if (!profile || checkingIn) return;
    setCheckingIn(true);
    haptics.tap();
    try {
      if (myCheckIn) await deleteCheckIn(myCheckIn.id);
      else await createCheckIn(profile.id, 'offer', offerId);
      await load();
    } catch {
      showToast('Couldn’t update your check-in. Try again.', 'error');
    } finally {
      setCheckingIn(false);
    }
  };

  const ping = async (checkIn: VisibleCheckIn) => {
    setPingingId(checkIn.id);
    try {
      await sendPing(checkIn.id);
      haptics.success();
      showToast(`Pinged ${checkIn.user.display_name}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t send ping.', 'error');
    } finally {
      setPingingId(null);
    }
  };

  const myStreak = profile?.current_streak ?? 0;
  const unlocked = offer ? myStreak >= offer.min_streak : false;

  const claim = async () => {
    if (!offer || claiming) return;
    setClaiming(true);
    const { data, error } = await supabase.rpc('claim_offer', { offer_id_input: offer.id });
    setClaiming(false);
    if (error || !data?.[0]) {
      showToast(error?.message ?? 'Couldn’t claim this offer.', 'error');
      return;
    }
    haptics.success();
    setClaimCode(data[0].code);
    refreshProfile();
  };

  if (!loaded) {
    return (
      <View style={styles.container}>
        <BackButton style={styles.back}>
          <Icon name="arrow-left" size={17} color={colors.ink} />
        </BackButton>
        <Skeleton style={{ height: 220, borderRadius: 0 }} />
        <View style={styles.body}>
          <Skeleton style={{ height: 11, width: '30%' }} />
          <Skeleton style={{ height: 22, width: '70%', marginTop: 8 }} />
          <Skeleton style={{ height: 15, width: '35%', marginTop: 8 }} />
          <Skeleton style={{ height: 14, width: '90%', marginTop: 14 }} />
          <Skeleton style={{ height: 48, width: '100%', marginTop: 20, borderRadius: radius.button }} />
        </View>
      </View>
    );
  }
  if (!offer) {
    return (
      <View style={styles.notFound}>
        <BackButton style={styles.back}>
          <Icon name="arrow-left" size={17} color={colors.ink} />
        </BackButton>
        <Text style={styles.notFoundText}>This offer isn’t available.</Text>
      </View>
    );
  }

  return (
    <Animated.ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }} onScroll={onScroll} scrollEventThrottle={16}>
      <BackButton style={styles.back}>
        <Icon name="arrow-left" size={17} color={colors.ink} />
      </BackButton>
      <View style={styles.hero}>
        <Animated.View style={[StyleSheet.absoluteFill, heroAnimatedStyle]}>
          {offer.image_url ? (
            <Image source={{ uri: offer.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : (
            <PhotoPlaceholder icon="gift" style={StyleSheet.absoluteFill} />
          )}
        </Animated.View>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, heroDimStyle]} />
      </View>
      <View style={styles.body}>
        <Text style={styles.brand}>{offer.brand?.name ?? 'Havenly Partner'}</Text>
        <Text style={styles.title}>{offer.title}</Text>
        <Text style={styles.discount}>{offer.discount_label}</Text>
        {offer.description ? <Text style={styles.description}>{offer.description}</Text> : null}

        {offer.min_streak > 0 && (
          <View style={styles.streakRow}>
            <Icon name="zap" size={13} color={colors.coral} />
            <Text style={styles.streakRowText}>Requires a {offer.min_streak}-day streak. You’re at {myStreak}.</Text>
          </View>
        )}

        {claimCode ? (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Show this to staff</Text>
            <Text style={styles.code}>{claimCode}</Text>
          </View>
        ) : unlocked ? (
          <AnimatedPressable style={styles.claimBtn} onPress={claim} disabled={claiming} accessibilityLabel="Claim this offer">
            {claiming ? <ActivityIndicator color="white" /> : <Text style={styles.claimBtnText}>Claim this perk</Text>}
          </AnimatedPressable>
        ) : (
          <View style={styles.lockedBox}>
            <Icon name="lock" size={14} color={colors.inkSoft} />
            <Text style={styles.lockedText}>Keep your streak going to unlock this.</Text>
          </View>
        )}

        {offer.latitude != null && offer.longitude != null && (
          <View style={styles.checkInSection}>
            <AnimatedPressable
              style={[styles.goingBtn, myInterest && styles.goingBtnActive]}
              onPress={toggleGoing}
              disabled={togglingInterest}
              accessibilityLabel={myInterest ? "Not down to go anymore" : "I'm down to go"}
            >
              {togglingInterest ? (
                <ActivityIndicator size="small" color={myInterest ? colors.gold : colors.ink} />
              ) : (
                <>
                  <Icon name="thumbs-up" size={14} color={myInterest ? colors.gold : colors.ink} weight={myInterest ? 'fill' : undefined} />
                  <Text style={[styles.goingBtnText, myInterest && styles.goingBtnTextActive]}>
                    {myInterest ? "You're down to go" : "I'm down to go"}
                  </Text>
                </>
              )}
            </AnimatedPressable>
            {interests.length > 0 && (
              <View style={styles.goingList}>
                {interests.slice(0, 8).map((i) => (
                  i.user.avatar_url ? (
                    <Image key={i.id} source={{ uri: i.user.avatar_url }} style={styles.goingAvatar} transition={200} />
                  ) : (
                    <InitialsAvatar key={i.id} name={i.user.display_name} style={styles.goingAvatar} />
                  )
                ))}
                <Text style={styles.goingListText}>
                  {interests.length} {interests.length === 1 ? 'person' : 'people'} down to go
                </Text>
              </View>
            )}

            <AnimatedPressable
              style={[styles.checkInBtn, myCheckIn && styles.checkInBtnActive]}
              onPress={toggleCheckIn}
              disabled={checkingIn}
              accessibilityLabel={myCheckIn ? 'Check out' : 'Check in here'}
            >
              {checkingIn ? (
                <ActivityIndicator size="small" color={myCheckIn ? colors.coral : 'white'} />
              ) : (
                <>
                  <Icon name="map-pin" size={14} color={myCheckIn ? colors.coral : 'white'} />
                  <Text style={[styles.checkInBtnText, myCheckIn && styles.checkInBtnTextActive]}>
                    {myCheckIn ? 'You’re checked in' : 'Check in here'}
                  </Text>
                </>
              )}
            </AnimatedPressable>

            {checkIns.length > 0 && (
              <View style={styles.checkInList}>
                <Text style={styles.checkInListLabel}>{checkIns.length} checked in nearby</Text>
                {checkIns.map((c) => (
                  <View key={c.id} style={styles.checkInRow}>
                    {c.user.avatar_url ? (
                      <Image source={{ uri: c.user.avatar_url }} style={styles.checkInAvatar} transition={200} />
                    ) : (
                      <InitialsAvatar name={c.user.display_name} style={styles.checkInAvatar} />
                    )}
                    <Text style={styles.checkInName}>{c.user.display_name}{c.user_id === profile?.id ? ' (you)' : ''}</Text>
                    {c.user_id !== profile?.id && (
                      <Pressable
                        style={styles.pingBtn}
                        onPress={() => ping(c)}
                        disabled={pingingId === c.id}
                        accessibilityLabel={`Ping ${c.user.display_name}`}
                      >
                        {pingingId === c.id ? (
                          <ActivityIndicator size="small" color={colors.ink} />
                        ) : (
                          <>
                              <Icon name="hand-waving" size={13} color={colors.ink} />
                              <Text style={styles.pingBtnText}>Ping</Text>
                            </>
                        )}
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>
    </Animated.ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  centered: { flex: 1, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  notFound: { flex: 1, backgroundColor: colors.sand, paddingTop: 60, paddingHorizontal: spacing.lg },
  notFoundText: { color: colors.inkSoft, textAlign: 'center', marginTop: 100 },
  back: {
    position: 'absolute', top: 50, left: 16, zIndex: 1, width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  hero: { height: 220, overflow: 'hidden' },
  body: { padding: spacing.lg },
  brand: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.teal },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 22, color: colors.ink, marginTop: 6 },
  discount: { fontSize: 15, fontWeight: '700', color: colors.coral, marginTop: 6 },
  description: { fontSize: 13.5, color: colors.inkSoft, lineHeight: 20, marginTop: 12 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16 },
  streakRowText: { fontSize: 12.5, color: colors.inkSoft },
  claimBtn: { marginTop: 20, backgroundColor: colors.coral, paddingVertical: 15, borderRadius: radius.button, alignItems: 'center' },
  claimBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  lockedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, backgroundColor: colors.sandDeep,
    paddingVertical: 13, paddingHorizontal: 16, borderRadius: radius.button,
  },
  lockedText: { flex: 1, color: colors.inkSoft, fontSize: 12.5, fontWeight: '600' },
  codeCard: {
    marginTop: 20, backgroundColor: colors.ink, borderRadius: radius.md, paddingVertical: 20, alignItems: 'center',
  },
  codeLabel: { fontSize: 11.5, color: colors.sand, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'PlusJakartaSans_700Bold' },
  code: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 30, fontWeight: '700', color: colors.sand, letterSpacing: 6, marginTop: 8 },
  checkInSection: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderColor: colors.line },
  goingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.sandDeep,
    paddingVertical: 13, borderRadius: radius.button, borderWidth: 1.5, borderColor: colors.line,
  },
  goingBtnActive: { backgroundColor: `${colors.gold}26`, borderColor: colors.gold },
  goingBtnText: { color: colors.ink, fontWeight: '700', fontSize: 13.5 },
  goingBtnTextActive: { color: colors.gold },
  goingList: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  goingAvatar: { width: 24, height: 24, borderRadius: 12, marginLeft: -8, borderWidth: 2, borderColor: colors.sand },
  goingListText: { marginLeft: 6, fontSize: 11.5, color: colors.inkSoft, fontWeight: '600' },
  checkInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.teal,
    paddingVertical: 13, borderRadius: radius.button, marginTop: 20,
  },
  checkInBtnActive: { backgroundColor: colors.tealSoft, borderWidth: 1.5, borderColor: colors.teal },
  checkInBtnText: { color: 'white', fontWeight: '700', fontSize: 13.5 },
  checkInBtnTextActive: { color: colors.teal },
  checkInList: { marginTop: 18 },
  checkInListLabel: {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.inkSoft, marginBottom: 10,
  },
  checkInRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  checkInAvatar: { width: 32, height: 32, borderRadius: 16 },
  checkInName: { flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.ink },
  pingBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.button, backgroundColor: colors.sandDeep, borderWidth: 1, borderColor: colors.line },
  pingBtnText: { fontSize: 11.5, fontWeight: '700', color: colors.ink },
  });
}
