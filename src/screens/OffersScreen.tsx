import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import EmptyState from '@/components/EmptyState';
import type { Offer } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function OffersScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const myStreak = profile?.current_streak ?? 0;

  const load = useCallback(async () => {
    const now = new Date().toISOString();
    const { data } = await supabase.from('offers')
      .select('*, brand:brands(*)')
      .eq('is_active', true)
      .lte('starts_at', now)
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .order('min_streak', { ascending: true });
    setOffers((data as unknown as Offer[]) ?? []);
    setLoaded(true);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={17} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Perks</Text>
      </View>
      <View style={styles.streakBanner}>
        <Text style={styles.streakBannerText}>🔥 Your streak: {myStreak} day{myStreak === 1 ? '' : 's'}</Text>
      </View>
      <FlatList
        data={offers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
        ListEmptyComponent={loaded ? <EmptyState icon="gift" text="No perks available right now — check back soon." /> : null}
        renderItem={({ item }) => {
          const unlocked = myStreak >= item.min_streak;
          return (
            <Pressable style={styles.card} onPress={() => navigation.navigate('OfferDetail', { offerId: item.id })}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={styles.cardImage} contentFit="cover" transition={200} />
              ) : (
                <LinearGradient colors={['#FF7A5C', '#0F8B82']} style={styles.cardImage} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.cardBrand}>{item.brand?.name ?? 'Havenly Partner'}</Text>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.cardDiscount}>{item.discount_label}</Text>
              </View>
              {unlocked ? (
                <Feather name="chevron-right" size={18} color={colors.inkSoft} />
              ) : (
                <View style={styles.lockBadge}>
                  <Feather name="lock" size={11} color={colors.inkSoft} />
                  <Text style={styles.lockBadgeText}>{item.min_streak}d</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 54, paddingBottom: 12, paddingHorizontal: spacing.lg },
  back: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 19, color: colors.ink },
  streakBanner: { marginHorizontal: spacing.lg, marginBottom: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.coralSoft, alignItems: 'center' },
  streakBannerText: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12, marginBottom: 10 },
  cardImage: { width: 56, height: 56, borderRadius: 12 },
  cardBrand: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 10, textTransform: 'uppercase', color: colors.teal },
  cardTitle: { fontSize: 13.5, fontWeight: '700', color: colors.ink, marginTop: 2, lineHeight: 17 },
  cardDiscount: { fontSize: 12, color: colors.coral, fontWeight: '700', marginTop: 3 },
  lockBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.sandDeep, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.pill },
  lockBadgeText: { fontSize: 10.5, fontWeight: '700', color: colors.inkSoft },
  });
}
