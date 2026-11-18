import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text } from '@/components/Text';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import PhotoPlaceholder from '@/components/PhotoPlaceholder';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { ENQUIRY_STATUS_LABEL, formatMonth } from '@/lib/housing';
import { timeAgo } from '@/utils/timeAgo';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import { StateBlock } from '@/components/housing/parts';
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
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!myId) return;
    const { data, error } = await supabase.from('housing_enquiries')
      .select('*, residence:residences(id, name, area, photo_urls, provider_name), room_type:room_types(id, name, price_aed, billing_period)')
      .eq('user_id', myId)
      .order('created_at', { ascending: false });
    if (error) setFailed(true);
    else {
      setFailed(false);
      setEnquiries((data as unknown as HousingEnquiry[]) ?? []);
    }
    setLoaded(true);
  }, [myId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const statusTone = (status: EnquiryStatus) => {
    if (status === 'signed') return { bg: '#1F1B16', fg: '#FFFFFF' };
    if (status === 'lost') return { bg: colors.sandDeep, fg: colors.inkBody };
    if (status === 'new') return { bg: colors.tintBg, fg: colors.tintText };
    return { bg: colors.dealBg, fg: colors.dealText };
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
      ) : failed ? (
        <StateBlock icon="alert-circle" kind="error" title="We could not load your enquiries" body="Check your connection and try again."
          primary={{ label: 'Try again', onPress: () => { setLoaded(false); load(); } }} />
      ) : (
        <FlatList
          data={enquiries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
          ListEmptyComponent={<StateBlock icon="clipboard" title="No enquiries yet" body="Ask a residence a question or book a viewing from its page." primary={{ label: 'Browse housing', onPress: () => navigation.navigate('MainTabs', { screen: 'Housing' }) }} />}
          renderItem={({ item, index }) => {
            const tone = statusTone(item.status);
            const photo = item.residence?.photo_urls?.[0];
            return (
              <Animated.View>
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
    back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 26, letterSpacing: -0.4, color: colors.ink },
    card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
    thumb: { width: 60, height: 60, borderRadius: radius.sm },
    name: { fontSize: 15, fontWeight: '700', color: colors.ink },
    meta: { fontSize: 13, color: colors.inkBody, marginTop: 2 },
    footRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 },
    statusPill: { paddingHorizontal: 10, minHeight: 26, justifyContent: 'center', borderRadius: 8 },
    statusText: { fontSize: 12, fontWeight: '700' },
    time: { fontSize: 12, color: colors.inkMuted },
  });
}
