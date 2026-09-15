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
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import EmptyState from '@/components/EmptyState';
import { timeAgo } from '@/utils/timeAgo';
import type { Notification } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ICON_BY_TYPE: Record<Notification['type'], keyof typeof Feather.glyphMap> = {
  follow: 'user-plus',
  like: 'heart',
  comment: 'message-circle',
};

function messageFor(n: Notification): string {
  const name = n.actor?.display_name ?? 'Someone';
  if (n.type === 'follow') return `${name} started following you`;
  if (n.type === 'like') return `${name} liked your post`;
  return `${name} commented on your post`;
}

export default function NotificationsScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;

  const [rows, setRows] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!myId) return;
    const { data } = await supabase.from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(*), post:posts(id, title, image_url)')
      .eq('recipient_id', myId)
      .order('created_at', { ascending: false })
      .limit(100);
    setRows((data as unknown as Notification[]) ?? []);
    setLoaded(true);

    // Snapshot each row's real is_read state into local state above before
    // this, so unread rows still render highlighted for this viewing —
    // marking them read here only affects the badge and the *next* visit.
    const unreadIds = (data ?? []).filter((n) => !n.is_read).map((n) => n.id);
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

  const openNotification = (n: Notification) => {
    if (n.type === 'follow') {
      navigation.navigate('UserProfile', { userId: n.actor_id });
    } else if (n.post_id) {
      navigation.navigate('PostDetail', { postId: n.post_id });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={17} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
        ListEmptyComponent={loaded ? <EmptyState icon="bell" text="No notifications yet." /> : null}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.row, !item.is_read && styles.rowUnread]}
            onPress={() => openNotification(item)}
          >
            <View style={styles.iconChip}>
              <Feather name={ICON_BY_TYPE[item.type]} size={15} color={colors.coral} />
            </View>
            {item.actor?.avatar_url ? (
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
          </Pressable>
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
  });
}
