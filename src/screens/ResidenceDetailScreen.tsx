import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import PhotoPlaceholder from '@/components/PhotoPlaceholder';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { useParallaxHero } from '@/lib/animations';
import {
  amenityIcon, annualPrice, ENQUIRY_STATUS_LABEL, formatAed, GENDER_POLICY_LABEL, PERIOD_LABEL, setResidenceSaved,
} from '@/lib/housing';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import BurstHeart from '@/components/BurstHeart';
import Skeleton from '@/components/Skeleton';
import { radius, spacing } from '@/theme/tokens';
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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;
  const { onScroll, scrollY, heroAnimatedStyle, heroDimStyle } = useParallaxHero(HERO_HEIGHT);
  // Once the photo has scrolled away, the floating back/save buttons would
  // sit on top of the text underneath — a solid bar fades in behind them.
  const compactHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO_HEIGHT - 140, HERO_HEIGHT - 70], [0, 1], Extrapolation.CLAMP),
  }));

  const [residence, setResidence] = useState<Residence | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [openEnquiryStatus, setOpenEnquiryStatus] = useState<EnquiryStatus | null>(null);

  const load = useCallback(async () => {
    const [{ data: residenceRow }, { data: savedRow }, { data: enquiryRows }] = await Promise.all([
      supabase.from('residences').select('*, room_types(*)').eq('id', residenceId).maybeSingle(),
      myId
        ? supabase.from('saved_residences').select('residence_id').eq('user_id', myId).eq('residence_id', residenceId).maybeSingle()
        : Promise.resolve({ data: null }),
      myId
        ? supabase.from('housing_enquiries').select('status').eq('user_id', myId).eq('residence_id', residenceId)
          .order('created_at', { ascending: false }).limit(1)
        : Promise.resolve({ data: [] }),
    ]);
    const row = residenceRow as Residence | null;
    if (row?.room_types) {
      row.room_types = [...row.room_types].sort((a, b) => a.sort_order - b.sort_order || annualPrice(a) - annualPrice(b));
    }
    setResidence(row);
    setSaved(!!savedRow);
    setOpenEnquiryStatus(((enquiryRows as { status: EnquiryStatus }[]) ?? [])[0]?.status ?? null);
    setLoaded(true);
  }, [residenceId, myId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleSaved = async () => {
    if (!myId) return;
    const next = !saved;
    haptics.tap();
    setSaved(next);
    try {
      await setResidenceSaved(myId, residenceId, next);
    } catch {
      setSaved(!next);
      showToast('Couldn’t update your saved list — try again', 'error');
    }
  };

  if (!loaded) {
    return (
      <View style={styles.container}>
        <BackButton style={[styles.back, { top: insets.top + 12 }]}>
          <Icon name="arrow-left" size={17} color="#20261F" />
        </BackButton>
        <Skeleton style={{ height: HERO_HEIGHT, borderRadius: 0 }} />
        <View style={styles.body}>
          <Skeleton style={{ height: 11, width: '35%' }} />
          <Skeleton style={{ height: 24, width: '70%', marginTop: 10 }} />
          <Skeleton style={{ height: 13, width: '45%', marginTop: 10 }} />
          <Skeleton style={{ height: 64, width: '100%', marginTop: 24, borderRadius: radius.md }} />
          <Skeleton style={{ height: 64, width: '100%', marginTop: 10, borderRadius: radius.md }} />
        </View>
      </View>
    );
  }

  if (!residence || !residence.is_active) {
    return (
      <View style={styles.notFound}>
        <BackButton style={[styles.back, { top: insets.top + 12 }]}>
          <Icon name="arrow-left" size={17} color="#20261F" />
        </BackButton>
        <Text style={styles.notFoundText}>This residence isn’t listed anymore.</Text>
      </View>
    );
  }

  const photos = residence.photo_urls;
  const heroPhoto = photos[photoIndex] ?? photos[0];
  const myUniversity = profile?.university ?? null;
  const rooms = residence.room_types ?? [];
  const hasAvailableRoom = rooms.some((r) => r.is_available);

  return (
    <View style={styles.container}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={styles.hero}>
          <Animated.View style={[StyleSheet.absoluteFill, heroAnimatedStyle]}>
            {heroPhoto ? (
              <Image source={{ uri: heroPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            ) : (
              <PhotoPlaceholder icon="home" style={StyleSheet.absoluteFill} />
            )}
          </Animated.View>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, heroDimStyle]} />
        </View>

        {photos.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
            {photos.map((url, i) => (
              <AnimatedPressable
                key={url}
                onPress={() => { haptics.tap(); setPhotoIndex(i); }}
                style={[styles.thumb, i === photoIndex && styles.thumbActive]}
                accessibilityLabel={`Show photo ${i + 1}`}
              >
                <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              </AnimatedPressable>
            ))}
          </ScrollView>
        )}

        <View style={styles.body}>
          <Text style={styles.area}>{residence.area}</Text>
          <Text style={styles.name}>{residence.name}</Text>
          <Text style={styles.provider}>Run by {residence.provider_name}</Text>

          <View style={styles.factRow}>
            <View style={styles.fact}>
              <Icon name="users" size={12} color={colors.inkSoft} />
              <Text style={styles.factText}>{GENDER_POLICY_LABEL[residence.gender_policy]}</Text>
            </View>
            {residence.address ? (
              <View style={[styles.fact, { flexShrink: 1 }]}>
                <Icon name="map-pin" size={12} color={colors.inkSoft} />
                <Text style={styles.factText} numberOfLines={1}>{residence.address}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.sectionLabel}>Rooms</Text>
          {rooms.length === 0 ? (
            <Text style={styles.muted}>Room prices are coming soon — send a question to ask.</Text>
          ) : (
            rooms.map((room) => (
              <View key={room.id} style={[styles.roomRow, !room.is_available && styles.roomRowFull]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roomName}>{room.name}</Text>
                  <Text style={styles.roomMeta}>
                    {room.occupancy === 1 ? 'Private room' : `Shared · ${room.occupancy} people`}
                    {!room.is_available ? ' · Full' : ''}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.roomPrice}>{formatAed(room.price_aed)}</Text>
                  <Text style={styles.roomPeriod}>per {PERIOD_LABEL[room.billing_period]}</Text>
                </View>
              </View>
            ))
          )}

          {residence.amenities.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>What’s included</Text>
              <View style={styles.amenityGrid}>
                {residence.amenities.map((a) => (
                  <View key={a} style={styles.amenity}>
                    <Icon name={amenityIcon(a)} size={13} color={colors.teal} />
                    <Text style={styles.amenityText}>{a}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {residence.nearby_universities.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Close to</Text>
              {residence.nearby_universities.map((u) => {
                const mine = u === myUniversity;
                return (
                  <View key={u} style={styles.uniRow}>
                    <Icon name="book" size={13} color={mine ? colors.coral : colors.inkSoft} />
                    <Text style={[styles.uniText, mine && styles.uniTextMine]}>{u}{mine ? ' · your uni' : ''}</Text>
                  </View>
                );
              })}
            </>
          )}

          {residence.description ? (
            <>
              <Text style={styles.sectionLabel}>About</Text>
              <Text style={styles.description}>{residence.description}</Text>
            </>
          ) : null}

          <View style={styles.howItWorks}>
            <Icon name="info" size={14} color={colors.teal} />
            <Text style={styles.howItWorksText}>
              Havenly is free for students. Send an enquiry here, {residence.provider_name} gets in touch with you, and you sign directly with them.
            </Text>
          </View>
        </View>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents="none"
        style={[styles.compactHeader, { height: insets.top + 58, paddingTop: insets.top + 12 }, compactHeaderStyle]}
      >
        <Text style={styles.compactTitle} numberOfLines={1}>{residence.name}</Text>
      </Animated.View>
      <BackButton style={[styles.back, { top: insets.top + 12 }]}>
        <Icon name="arrow-left" size={17} color="#20261F" />
      </BackButton>
      <AnimatedPressable
        style={[styles.saveBtn, { top: insets.top + 12 }]}
        scaleTo={0.85}
        onPress={toggleSaved}
        accessibilityLabel={saved ? 'Remove from saved' : 'Save residence'}
      >
        <BurstHeart active={saved} size={16} color="#20261F" activeColor="#FF5A3C" />
      </AnimatedPressable>

      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + 14 }]}>
        {openEnquiryStatus && (
          <AnimatedPressable style={styles.enquiryStatusRow} onPress={() => navigation.navigate('MyEnquiries')}>
            <Icon name="check-circle" size={13} color={colors.teal} />
            <Text style={styles.enquiryStatusText}>You’ve enquired · {ENQUIRY_STATUS_LABEL[openEnquiryStatus]}</Text>
            <Icon name="chevron-right" size={13} color={colors.inkSoft} />
          </AnimatedPressable>
        )}
        <View style={styles.ctaButtons}>
          <AnimatedPressable
            style={[styles.ctaBtn, styles.ctaSecondary]}
            onPress={() => navigation.navigate('HousingEnquiry', { residenceId, kind: 'question' })}
            accessibilityLabel="Ask a question"
          >
            <Text style={styles.ctaSecondaryText}>Ask a question</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.ctaBtn, styles.ctaPrimary, !hasAvailableRoom && rooms.length > 0 && styles.ctaDisabled]}
            disabled={!hasAvailableRoom && rooms.length > 0}
            onPress={() => navigation.navigate('HousingEnquiry', { residenceId, kind: 'viewing' })}
            accessibilityLabel="Book a viewing"
          >
            <Text style={styles.ctaPrimaryText}>{!hasAvailableRoom && rooms.length > 0 ? 'Currently full' : 'Book a viewing'}</Text>
          </AnimatedPressable>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    notFound: { flex: 1, backgroundColor: colors.sand, paddingHorizontal: spacing.lg },
    notFoundText: { color: colors.inkSoft, textAlign: 'center', marginTop: 160 },
    back: {
      position: 'absolute', left: 16, zIndex: 2, width: 34, height: 34, borderRadius: 17,
      backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center',
    },
    saveBtn: {
      position: 'absolute', right: 16, zIndex: 2, width: 34, height: 34, borderRadius: 17,
      backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center',
    },
    hero: { height: HERO_HEIGHT, overflow: 'hidden', backgroundColor: colors.sandDeep },
    compactHeader: {
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, backgroundColor: colors.sand,
      borderBottomWidth: 1, borderColor: colors.line, paddingHorizontal: 64, alignItems: 'center',
    },
    compactTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 15, color: colors.ink, lineHeight: 34 },
    thumbRow: { gap: 8, paddingHorizontal: spacing.lg, paddingTop: 12 },
    thumb: { width: 64, height: 48, borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.sandDeep },
    thumbActive: { borderColor: colors.coral },
    body: { padding: spacing.lg },
    area: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.teal },
    name: { fontFamily: 'Fraunces_600SemiBold', fontSize: 25, color: colors.ink, marginTop: 6 },
    provider: { fontSize: 13, color: colors.inkSoft, marginTop: 4 },
    factRow: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
    fact: {
      flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderWidth: 1,
      borderColor: colors.line, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill,
    },
    factText: { fontSize: 12, fontWeight: '600', color: colors.ink },
    sectionLabel: {
      fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft,
      fontWeight: '600', marginTop: 26, marginBottom: 10,
    },
    muted: { fontSize: 13, color: colors.inkSoft },
    roomRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderWidth: 1,
      borderColor: colors.line, borderRadius: radius.md, padding: 14, marginBottom: 8,
    },
    roomRowFull: { opacity: 0.55 },
    roomName: { fontSize: 14, fontWeight: '700', color: colors.ink },
    roomMeta: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
    roomPrice: { fontSize: 15, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
    roomPeriod: { fontSize: 11, color: colors.inkSoft, marginTop: 1 },
    amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    amenity: {
      flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.tealSoft,
      paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill,
    },
    amenityText: { fontSize: 12, fontWeight: '600', color: colors.ink },
    uniRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
    uniText: { fontSize: 13, color: colors.ink, flexShrink: 1 },
    uniTextMine: { fontWeight: '700', color: colors.coral },
    description: { fontSize: 13.5, color: colors.inkSoft, lineHeight: 20 },
    howItWorks: {
      flexDirection: 'row', gap: 10, marginTop: 26, backgroundColor: colors.white, borderWidth: 1,
      borderColor: colors.line, borderRadius: radius.md, padding: 14,
    },
    howItWorksText: { flex: 1, fontSize: 12.5, color: colors.inkSoft, lineHeight: 18 },
    ctaBar: {
      position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.sand,
      borderTopWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.lg, paddingTop: 12,
    },
    enquiryStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    enquiryStatusText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.ink },
    ctaButtons: { flexDirection: 'row', gap: 10 },
    ctaBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.pill, alignItems: 'center' },
    ctaSecondary: { borderWidth: 1.5, borderColor: colors.ink },
    ctaSecondaryText: { fontSize: 14, fontWeight: '700', color: colors.ink },
    ctaPrimary: { backgroundColor: colors.coral },
    ctaPrimaryText: { fontSize: 14, fontWeight: '700', color: 'white' },
    ctaDisabled: { backgroundColor: colors.inkSoft },
  });
}
