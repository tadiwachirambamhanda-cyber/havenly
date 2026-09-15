import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { Offer } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'OfferDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function OfferDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { offerId } = route.params;
  const { profile, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [offer, setOffer] = useState<Offer | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimCode, setClaimCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [{ data: offerData }, { data: claimData }] = await Promise.all([
      supabase.from('offers').select('*, brand:brands(*)').eq('id', offerId).maybeSingle(),
      profile
        ? supabase.from('offer_claims').select('code').eq('offer_id', offerId).eq('user_id', profile.id).maybeSingle()
        : Promise.resolve({ data: null as { code: string } | null }),
    ]);
    setOffer(offerData as unknown as Offer);
    setClaimCode(claimData?.code ?? null);
    setLoaded(true);
  }, [offerId, profile]);

  useEffect(() => { load(); }, [load]);

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
    return <View style={styles.centered}><ActivityIndicator color={colors.coral} /></View>;
  }
  if (!offer) {
    return (
      <View style={styles.notFound}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={17} color={colors.ink} />
        </Pressable>
        <Text style={styles.notFoundText}>This offer isn’t available.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
        <Feather name="arrow-left" size={17} color={colors.ink} />
      </Pressable>
      {offer.image_url ? (
        <Image source={{ uri: offer.image_url }} style={styles.hero} contentFit="cover" transition={200} />
      ) : (
        <LinearGradient colors={['#FF7A5C', '#0F8B82']} style={styles.hero} />
      )}
      <View style={styles.body}>
        <Text style={styles.brand}>{offer.brand?.name ?? 'Havenly Partner'}</Text>
        <Text style={styles.title}>{offer.title}</Text>
        <Text style={styles.discount}>{offer.discount_label}</Text>
        {offer.description ? <Text style={styles.description}>{offer.description}</Text> : null}

        {offer.min_streak > 0 && (
          <View style={styles.streakRow}>
            <Feather name="zap" size={13} color={colors.coral} />
            <Text style={styles.streakRowText}>Requires a {offer.min_streak}-day streak — you’re at {myStreak}.</Text>
          </View>
        )}

        {claimCode ? (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Show this to staff</Text>
            <Text style={styles.code}>{claimCode}</Text>
          </View>
        ) : unlocked ? (
          <Pressable style={styles.claimBtn} onPress={claim} disabled={claiming} accessibilityLabel="Claim this offer">
            {claiming ? <ActivityIndicator color="white" /> : <Text style={styles.claimBtnText}>Claim this perk</Text>}
          </Pressable>
        ) : (
          <View style={styles.lockedBox}>
            <Feather name="lock" size={14} color={colors.inkSoft} />
            <Text style={styles.lockedText}>Keep your streak going to unlock this.</Text>
          </View>
        )}
      </View>
    </ScrollView>
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
  hero: { height: 220 },
  body: { padding: spacing.lg },
  brand: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.teal },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 22, color: colors.ink, marginTop: 6 },
  discount: { fontSize: 15, fontWeight: '700', color: colors.coral, marginTop: 6 },
  description: { fontSize: 13.5, color: colors.inkSoft, lineHeight: 20, marginTop: 12 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 16 },
  streakRowText: { fontSize: 12.5, color: colors.inkSoft },
  claimBtn: { marginTop: 20, backgroundColor: colors.coral, paddingVertical: 15, borderRadius: radius.pill, alignItems: 'center' },
  claimBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  lockedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, backgroundColor: colors.sandDeep,
    paddingVertical: 13, paddingHorizontal: 16, borderRadius: radius.pill,
  },
  lockedText: { flex: 1, color: colors.inkSoft, fontSize: 12.5, fontWeight: '600' },
  codeCard: {
    marginTop: 20, backgroundColor: colors.ink, borderRadius: radius.md, paddingVertical: 20, alignItems: 'center',
  },
  codeLabel: { fontSize: 11.5, color: colors.sand, opacity: 0.7, textTransform: 'uppercase', fontFamily: 'JetBrainsMono_500Medium' },
  code: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 30, fontWeight: '700', color: colors.sand, letterSpacing: 6, marginTop: 8 },
  });
}
