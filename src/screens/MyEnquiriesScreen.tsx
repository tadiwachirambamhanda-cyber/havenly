import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text } from '@/components/Text';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';
import PhotoPlaceholder from '@/components/PhotoPlaceholder';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { calmDuration, calmEasing } from '@/lib/animations';
import { ENQUIRY_STATUS_LABEL, formatMonth } from '@/lib/housing';
import { timeAgo } from '@/utils/timeAgo';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import EmptyState from '@/components/EmptyState';
import PersonRowSkeleton from '@/components/PersonRowSkeleton';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { EnquiryStatus, HousingEnquiry } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function MyEnquiriesScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;
  const [enquiries, setEnquiries] = useState<HousingEnquiry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!myId) return;
    const { data } = await supabase.from('housing_enquiries')
      .select('*, residence:residences(id, name, area, photo_urls, provider_name), room_type:room_types(id, name, price_aed, billing_period)')
      .eq('user_id', myId)
      .order('created_at', { ascending: false });
    setEnquiries((data as unknown as HousingEnquiry[]) ?? []);
    setLoaded(true);
  }, [myId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const statusTone = (status: EnquiryStatus) => {
    if (status === 'signed') return { bg: colors.tealSoft, fg: colors.teal };
    if (status === 'lost') return { bg: colors.sandDeep, fg: colors.inkSoft };
    if (status === 'new') return { bg: colors.coralSoft, fg: colors.coral };
    return { bg: `${colors.gold}26`, fg: colors.gold };
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton style={styles.back}>
          <Icon name="arrow-left" size={17} color={colors.ink} />
        </BackButton>
        <Text style={styles.title}>My enquiries</Text>
      </View>
      {!loaded ? (
        <View style={{ paddingTop: spacing.sm }}>{[0, 1, 2].map((i) => <PersonRowSkeleton key={i} />)}</View>
      ) : (
        <FlatList
          data={enquiries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
          ListEmptyComponent={<EmptyState icon="clipboard" text="No enquiries yet. Find a place in Housing and ask a question or book a viewing." />}
          renderItem={({ item, index }) => {
            const tone = statusTone(item.status);
            const photo = item.residence?.photo_urls?.[0];
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(calmDuration).easing(calmEasing)}>
                <AnimatedPressable
                  style={styles.card}
                  onPress={() => item.residence && navigation.navigate('ResidenceDetail', { residenceId: item.residence.id })}
                >
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" transition={200} />
                  ) : (
                    <PhotoPlaceholder icon="home" style={styles.thumb} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{item.residence?.name ?? 'Residence'}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {item.kind === 'viewing' ? 'Viewing' : 'Question'} · Moving in {formatMonth(item.move_in_month)}
                    </Text>
                    <View style={styles.footRow}>
                      <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.statusText, { color: tone.fg }]}>{ENQUIRY_STATUS_LABEL[item.status]}</Text>
                      </View>
                      <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
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
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 54, paddingBottom: 12, paddingHorizontal: spacing.lg },
    back: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 19, color: colors.ink },
    card: {
      flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderWidth: 1,
      borderColor: colors.line, borderRadius: radius.md, padding: 12, marginBottom: 10,
    },
    thumb: { width: 60, height: 60, borderRadius: radius.sm },
    name: { fontSize: 14, fontWeight: '700', color: colors.ink },
    meta: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
    footRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 },
    statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.tag },
    statusText: { fontSize: 11, fontWeight: '700' },
    time: { fontSize: 11, color: colors.inkSoft },
  });
}
