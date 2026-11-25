import { HOUSING_NOTIFICATION_TYPES } from '@/lib/notificationTypes';
import { alertMessage } from '@/lib/alerts';
import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text } from '@/components/Text';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import Animated from 'react-native-reanimated';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import InitialsAvatar from '@/components/InitialsAvatar';
import Icon, { type IconName } from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import EmptyState from '@/components/EmptyState';
import PersonRowSkeleton from '@/components/PersonRowSkeleton';
import { timeAgo } from '@/utils/timeAgo';
import type { EnquiryStatus, Notification } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
// place_title is resolved client-side after the initial fetch (ping-only —
// see load()), since check_ins.place_id can point at either offers or
// events and there's no single join that covers both.
type Row = Notification & { place_title?: string };

const ICON_BY_TYPE: Record<Notification['type'], IconName> = {
  follow: 'user-plus',
  like: 'heart',
  comment: 'message-circle',
  ping: 'hand-waving',
  enquiry_new: 'key',
  enquiry_status: 'key',
  new_place: 'home',
  price_drop: 'tag',
};

// From Havenly itself, not a person: shown with the Havenly mark.
const isFromHavenly = (n: Notification) => n.type === 'enquiry_status' || n.type === 'new_place' || n.type === 'price_drop';

const STATUS_MESSAGE: Partial<Record<EnquiryStatus, string>> = {
  contacted: 'is getting in touch with you',
  viewing_booked: 'booked your viewing',
  signed: 'confirmed your room. Time to plan the move.',
};

function messageFor(n: Row): string {
  if (n.type === 'new_place' || n.type === 'price_drop') return alertMessage({ ...n, type: n.type });
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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;

  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!myId) return;
    const { data } = await supabase.from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(*), post:posts(id, title, image_url), check_in:check_ins(id, place_type, place_id), enquiry:housing_enquiries(id, kind, residence:residences(id, name)), residence:residences(id, name)')
      .eq('recipient_id', myId)
      // Housing only: follow, like, comment and ping notifications are archived (tag archive/social-v1).
      .in('type', [...HOUSING_NOTIFICATION_TYPES])
      .order('created_at', { ascending: false })
      .limit(100);
    const notifs = (data as unknown as Notification[]) ?? [];

    setRows(notifs);
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
    } else if ((n.type === 'new_place' || n.type === 'price_drop') && n.residence_id) {
      // A listing hidden since opens the page's own "no longer listed" message.
      navigation.navigate('ResidenceDetail', { residenceId: n.residence_id });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton style={styles.back}>
          <Icon name="arrow-left" size={17} color={colors.ink} />
        </BackButton>
        <Text style={styles.title}>Notifications</Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
        ListEmptyComponent={loaded ? <EmptyState icon="bell" text="No notifications yet." /> : <PersonRowSkeleton count={8} />}
        renderItem={({ item, index }) => (
          <Animated.View>
          <AnimatedPressable
            style={[styles.row, !item.is_read && styles.rowUnread]}
            onPress={() => openNotification(item)}
          >
            <View style={styles.iconChip}>
              <Icon name={ICON_BY_TYPE[item.type]} size={15} color={colors.coral} />
            </View>
            {isFromHavenly(item) ? (
              <View style={[styles.avatar, styles.brandAvatar]}>
                <Text style={styles.brandMark}>h</Text>
              </View>
            ) : item.actor?.avatar_url ? (
              <Image source={{ uri: item.actor.avatar_url }} style={styles.avatar} transition={200} />
            ) : (
              <InitialsAvatar name={item.actor?.display_name} style={styles.avatar} />
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
  title: { fontFamily: 'SchibstedGrotesk_600SemiBold', fontSize: 19, color: colors.ink },
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
  brandAvatar: { backgroundColor: colors.coralFill, alignItems: 'center', justifyContent: 'center' },
  brandMark: { fontFamily: 'SchibstedGrotesk_700Bold_Italic', fontSize: 20, color: 'white', marginTop: -2 },
  });
}
