import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text } from '@/components/Text';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import Animated from 'react-native-reanimated';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import InitialsAvatar from '@/components/InitialsAvatar';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { haptics } from '@/lib/haptics';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import EmptyState from '@/components/EmptyState';
import PersonRowSkeleton from '@/components/PersonRowSkeleton';
import type { Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type FollowTab = 'followers' | 'following';
type Rt = RouteProp<RootStackParamList, 'FollowList'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const TABS: { key: FollowTab; label: string }[] = [
  { key: 'followers', label: 'Followers' },
  { key: 'following', label: 'Following' },
];

export default function FollowListScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { userId, initialTab, displayName } = route.params;
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [tab, setTab] = useState<FollowTab>(initialTab);
  const [list, setList] = useState<Profile[]>([]);
  const [myFollowingIds, setMyFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const myId = session?.user.id;
    const listQuery =
      tab === 'followers'
        ? supabase.from('follows').select('profile:profiles!follows_follower_id_fkey(*)').eq('following_id', userId)
        : supabase.from('follows').select('profile:profiles!follows_following_id_fkey(*)').eq('follower_id', userId);

    const [{ data: rows }, { data: myFollows }] = await Promise.all([
      listQuery,
      myId ? supabase.from('follows').select('following_id').eq('follower_id', myId) : Promise.resolve({ data: [] as { following_id: string }[] }),
    ]);

    const profiles = ((rows ?? []) as unknown as { profile: Profile }[]).map((r) => r.profile).filter(Boolean);
    setList(profiles);
    setMyFollowingIds(new Set((myFollows ?? []).map((f) => f.following_id)));
    setLoading(false);
    setRefreshing(false);
  }, [tab, userId, session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleFollow = async (targetId: string) => {
    const myId = session?.user.id;
    if (!myId || targetId === myId) return;
    haptics.tap();
    const isFollowing = myFollowingIds.has(targetId);
    setMyFollowingIds((prev) => {
      const next = new Set(prev);
      if (isFollowing) next.delete(targetId);
      else next.add(targetId);
      return next;
    });
    const { error } = isFollowing
      ? await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', targetId)
      : await supabase.from('follows').insert({ follower_id: myId, following_id: targetId });
    if (error) {
      // Put the button back the way it was if the write failed.
      setMyFollowingIds((prev) => {
        const next = new Set(prev);
        if (isFollowing) next.add(targetId);
        else next.delete(targetId);
        return next;
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton style={styles.back}>
          <Icon name="arrow-left" size={17} color={colors.ink} />
        </BackButton>
        <Text style={styles.title}>{displayName}</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <AnimatedPressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            {tab === t.key && <View style={styles.tabUnderline} />}
          </AnimatedPressable>
        ))}
      </View>

      {loading ? (
        <PersonRowSkeleton />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.coral} />}
          renderItem={({ item, index }) => {
            const isMe = item.id === session?.user.id;
            const isFollowing = myFollowingIds.has(item.id);
            return (
              <Animated.View style={styles.row}>
                <AnimatedPressable
                  style={styles.rowAuthorTap}
                  onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
                  accessibilityLabel={`View ${item.display_name}'s profile`}
                >
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatar} transition={200} />
                  ) : (
                    <InitialsAvatar name={item.display_name} style={styles.avatar} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{item.display_name}</Text>
                    <Text style={styles.handle}>@{item.username}{item.university ? ` · ${item.university}` : ''}</Text>
                  </View>
                </AnimatedPressable>
                {!isMe && (
                  <AnimatedPressable
                    style={[styles.followBtn, isFollowing && styles.followBtnActive]}
                    onPress={() => toggleFollow(item.id)}
                    accessibilityLabel={isFollowing ? `Unfollow ${item.display_name}` : `Follow ${item.display_name}`}
                  >
                    <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                      {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </AnimatedPressable>
                )}
              </Animated.View>
            );
          }}
          ListEmptyComponent={
            <EmptyState icon="users" text={tab === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'} />
          }
        />
      )}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 54, paddingBottom: 16, paddingHorizontal: spacing.lg },
  back: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 19, color: colors.ink },
  tabRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  tabTextActive: { color: colors.ink },
  tabUnderline: { position: 'absolute', bottom: -1, height: 2, width: '40%', backgroundColor: colors.ink, borderRadius: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowAuthorTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  name: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  handle: { fontSize: 11.5, color: colors.inkSoft, marginTop: 2 },
  followBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.button, backgroundColor: colors.ink },
  followBtnActive: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line },
  followBtnText: { fontSize: 12, fontWeight: '700', color: colors.sand },
  followBtnTextActive: { color: colors.ink },
  placeholder: { color: colors.inkSoft, textAlign: 'center', marginTop: 40 },
  });
}
