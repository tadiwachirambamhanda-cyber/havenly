import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { calmDuration, calmEasing } from '@/lib/animations';
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import EmptyState from '@/components/EmptyState';
import { timeAgo } from '@/utils/timeAgo';
import type { EnquiryStatus, Notification } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
// place_title is resolved client-side after the initial fetch (ping-only —
// see load()), since check_ins.place_id can point at either offers or
// events and there's no single join that covers both.
type Row = Notification & { place_title?: string };

const ICON_BY_TYPE: Record<Notification['type'], keyof typeof Feather.glyphMap> = {
  follow: 'user-plus',
  like: 'heart',
  comment: 'message-circle',
  ping: 'navigation',
  enquiry_new: 'key',
  enquiry_status: 'key',
};

const STATUS_MESSAGE: Partial<Record<EnquiryStatus, string>> = {
  contacted: 'is getting in touch with you',
  viewing_booked: 'booked your viewing',
  signed: 'confirmed your room — welcome home',
};

function messageFor(n: Row): string {
  const name = n.actor?.display_name ?? 'Someone';
  if (n.type === 'follow') return `${name} started following you`;
  if (n.type === 'like') return `${name} liked your post`;
  if (n.type === 'comment') return `${name} commented on your post`;
  const residence = n.enquiry?.residence?.name ?? 'a residence';
  if (n.type === 'enquiry_new') {
    return `${name} sent a ${n.enquiry?.kind === 'viewing' ? 'viewing request' : 'question'} for ${residence}`;
  }
  if (n.type === 'enquiry_status') {
    return `${residence} ${(n.enquiry_status && STATUS_MESSAGE[n.enquiry_status]) ?? 'updated your enquiry'}`;
  }
  return `${name} pinged you${n.place_title ? ` from ${n.place_title}` : ''}`;
}

export default function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;

  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!myId) return;
    const { data } = await supabase.from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(*), post:posts(id, title, image_url), check_in:check_ins(id, place_type, place_id), enquiry:housing_enquiries(id, kind, residence:residences(id, name))')
      .eq('recipient_id', myId)
      .order('created_at', { ascending: false })
      .limit(100);
    const notifs = (data as unknown as Notification[]) ?? [];

    // Ping notifications only — resolve the place name from whichever
    // table the check-in actually points at.
    const offerIds = notifs.filter((n) => n.check_in?.place_type === 'offer').map((n) => n.check_in!.place_id);
    const eventIds = notifs.filter((n) => n.check_in?.place_type === 'event').map((n) => n.check_in!.place_id);
    const [{ data: offerRows }, { data: eventRows }] = await Promise.all([
      offerIds.length ? supabase.from('offers').select('id, title').in('id', offerIds) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      eventIds.length ? supabase.from('events').select('id, title').in('id', eventIds) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    ]);
    const titleById = new Map([...(offerRows ?? []), ...(eventRows ?? [])].map((r) => [r.id, r.title]));

    setRows(notifs.map((n) => ({ ...n, place_title: n.check_in ? titleById.get(n.check_in.place_id) : undefined })));
    setLoaded(true);

    // Snapshot each row's real is_read state into local state above before
    // this, so unread rows still render highlighted for this viewing —
    // marking them read here only affects the badge and the *next* visit.
    const unreadIds = notifs.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length) {
      await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    }
  }, [myId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openNotification = (n: Row) => {
    if (n.type === 'enquiry_new' && n.enquiry_id) {
      navigation.navigate('AdminEnquiry', { enquiryId: n.enquiry_id });
    } else if (n.type === 'enquiry_status') {
      navigation.navigate('MyEnquiries');
    } else if (n.type === 'follow') {
      navigation.navigate('UserProfile', { userId: n.actor_id });
    } else if (n.type === 'ping' && n.check_in) {
      if (n.check_in.place_type === 'offer') navigation.navigate('OfferDetail', { offerId: n.check_in.place_id });
      else showToast('Open Discover to see this event.');
    } else if (n.post_id) {
      navigation.navigate('PostDetail', { postId: n.post_id });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton style={styles.back}>
          <Feather name="arrow-left" size={17} color={colors.ink} />
        </BackButton>
        <Text style={styles.title}>Notifications</Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
        ListEmptyComponent={loaded ? <EmptyState icon="bell" text="No notifications yet." /> : null}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(calmDuration).easing(calmEasing)}>
          <AnimatedPressable
            style={[styles.row, !item.is_read && styles.rowUnread]}
            onPress={() => openNotification(item)}
          >
            <View style={styles.iconChip}>
              <Feather name={ICON_BY_TYPE[item.type]} size={15} color={colors.coral} />
            </View>
            {item.type === 'enquiry_status' ? (
              <View style={[styles.avatar, styles.brandAvatar]}>
                <Text style={styles.brandMark}>h</Text>
              </View>
            ) : item.actor?.avatar_url ? (
              <Image source={{ uri: item.actor.avatar_url }} style={styles.avatar} transition={200} />
            ) : (
              <LinearGradient colors={['#0F8B82', '#FF5A3C']} style={styles.avatar} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.message}>{messageFor(item)}</Text>
              <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
            </View>
            {item.post?.image_url && (
              <Image source={{ uri: item.post.image_url }} style={styles.postThumb} contentFit="cover" transition={200} />
            )}
          </AnimatedPressable>
          </Animated.View>
        )}
      />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 54, paddingBottom: 16, paddingHorizontal: spacing.lg },
  back: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 19, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  rowUnread: { backgroundColor: colors.sandDeep },
  iconChip: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  message: { fontSize: 13, color: colors.ink, lineHeight: 18 },
  time: { fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  postThumb: { width: 40, height: 40, borderRadius: 8 },
  brandAvatar: { backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
  brandMark: { fontFamily: 'Fraunces_700Bold_Italic', fontSize: 20, color: 'white', marginTop: -2 },
  });
}
