import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, type ViewToken } from 'react-native';
import { useNavigation, useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { formatCount } from '@/utils/formatCount';
import { radius, spacing, gradients } from '@/theme/tokens';
import ActionSheet from '@/components/ActionSheet';
import EmptyState from '@/components/EmptyState';
import Skeleton from '@/components/Skeleton';
import VideoThumb from '@/components/VideoThumb';
import type { ColorTokens } from '@/theme/tokens';
import { INTEREST_OPTIONS } from '@/constants/interests';
import { interestIcon } from '@/constants/topicIcons';
import type { Post, Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type GridTab = 'posts' | 'saved' | 'tagged';

const GRID_TABS: { key: GridTab; label: string }[] = [
  { key: 'posts', label: 'Posts' }, { key: 'saved', label: 'Saved' }, { key: 'tagged', label: 'Tagged' },
];

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<GridTab>('posts');
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [visibleVideoIds, setVisibleVideoIds] = useState<Set<string>>(new Set());
  // FlatList (unlike FeedScreen's manual masonry ScrollView) has built-in
  // viewability tracking — no need to measure card positions by hand here.
  // Both refs must stay stable across renders or FlatList warns/ignores them.
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setVisibleVideoIds(new Set(viewableItems.map((vi) => vi.item.id)));
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const load = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) return;

    const [{ data: profileData }, { count: postCount }, { count: followerCount }, { count: followingCount }, { data: postData }, { data: savedData }] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
        supabase.from('posts').select('*').eq('author_id', userId).order('created_at', { ascending: false }),
        supabase.from('saved_posts').select('created_at, post:posts(*)').eq('user_id', userId).order('created_at', { ascending: false }),
      ]);

    setProfile(profileData as Profile);
    setStats({ posts: postCount ?? 0, followers: followerCount ?? 0, following: followingCount ?? 0 });
    setPosts((postData as Post[]) ?? []);
    setSavedPosts(((savedData ?? []) as unknown as { post: Post }[]).map((row) => row.post).filter(Boolean));
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      (async () => { await load(); setHasLoadedOnce(true); })();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleLongPressPost = (post: Post) => {
    haptics.tap();
    setDeleteTarget(post);
  };

  const confirmDeletePost = async () => {
    const target = deleteTarget;
    if (!target) return;
    // Removed from the grid immediately — the whole point of a long-press
    // shortcut is that it feels instant, not like it's waiting on a request.
    setPosts((prev) => prev.filter((p) => p.id !== target.id));
    setStats((prev) => ({ ...prev, posts: Math.max(prev.posts - 1, 0) }));
    const { error } = await supabase.from('posts').delete().eq('id', target.id);
    if (error) {
      setPosts((prev) => [...prev, target].sort((a, b) => b.created_at.localeCompare(a.created_at)));
      setStats((prev) => ({ ...prev, posts: prev.posts + 1 }));
      showToast('Couldn’t delete post. Try again.', 'error');
      return;
    }
    haptics.success();
    showToast('Post deleted');
  };

  if (!profile) {
    if (hasLoadedOnce) return null;
    return (
      <View style={styles.container}>
        <Skeleton style={{ height: 110, borderRadius: 0 }} />
        <View style={styles.avatarRow}>
          <Skeleton style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.sand }} />
          <Skeleton style={{ width: 96, height: 32, borderRadius: radius.pill, marginBottom: 6 }} />
        </View>
        <Skeleton style={{ height: 20, width: '50%', marginTop: 12, marginHorizontal: spacing.lg }} />
        <Skeleton style={{ height: 13, width: '35%', marginTop: 8, marginHorizontal: spacing.lg }} />
        <View style={[styles.statsRow, { gap: 22 }]}>
          {[0, 1, 2].map((i) => <Skeleton key={i} style={{ width: 40, height: 30 }} />)}
        </View>
        <View style={styles.skeletonGrid}>
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} style={styles.skeletonGridCell} />)}
        </View>
      </View>
    );
  }

  const interestChips = INTEREST_OPTIONS.filter((opt) => profile.interests.includes(opt.key));

  return (
    <FlatList
      style={styles.container}
      data={activeTab === 'posts' ? posts : activeTab === 'saved' ? savedPosts : []}
      keyExtractor={(item) => item.id}
      numColumns={3}
      columnWrapperStyle={{ gap: 2 }}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      renderItem={({ item, index }) => {
        const [from, to] = gradients[index % gradients.length];
        return (
          <Pressable
            style={styles.gridCell}
            onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
            onLongPress={activeTab === 'posts' ? () => handleLongPressPost(item) : undefined}
            delayLongPress={350}
          >
            <LinearGradient colors={[from, to]} style={StyleSheet.absoluteFill} />
            {item.video_url ? (
              <VideoThumb uri={item.video_url} isVisible={isFocused && visibleVideoIds.has(item.id)} />
            ) : item.image_url ? (
              <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            ) : null}
          </Pressable>
        );
      }}
      ListEmptyComponent={
        <EmptyState
          icon={activeTab === 'posts' ? 'grid' : activeTab === 'saved' ? 'bookmark' : 'tag'}
          text={activeTab === 'posts' ? 'No posts yet.' : activeTab === 'saved' ? 'Nothing saved yet.' : 'No tagged posts yet.'}
        />
      }
      ListHeaderComponent={
        <View>
          {profile.cover_url ? (
            <Image source={{ uri: profile.cover_url }} style={styles.cover} contentFit="cover" transition={200} />
          ) : (
            <LinearGradient colors={['#FF7A5C', '#E3A23A', '#0F8B82']} locations={[0, 0.6, 1]} style={styles.cover} />
          )}
          <Pressable
            style={[styles.settingsBtn, { top: insets.top + 12 }]}
            onPress={() => navigation.navigate('Settings')}
            accessibilityLabel="Settings"
          >
            <Feather name="settings" size={17} color="#20261F" />
          </Pressable>
          <View style={styles.avatarRow}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} transition={200} />
            ) : (
              <LinearGradient colors={['#0F8B82', '#FF5A3C']} style={styles.avatar} />
            )}
            <Pressable style={styles.editBtn} onPress={() => navigation.navigate('EditProfile')} accessibilityLabel="Edit profile">
              <Text style={styles.editBtnText}>Edit profile</Text>
            </Pressable>
          </View>

          <Text style={styles.name}>{profile.display_name}</Text>
          <Text style={styles.handle}>@{profile.username}{profile.university ? ` · ${profile.university}` : ''}</Text>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          <View style={styles.statsRow}>
            <View><Text style={styles.statNum}>{formatCount(stats.posts)}</Text><Text style={styles.statLabel}>Posts</Text></View>
            <Pressable
              onPress={() => navigation.navigate('FollowList', { userId: profile.id, initialTab: 'followers', displayName: profile.display_name })}
              accessibilityLabel="View followers"
            >
              <Text style={styles.statNum}>{formatCount(stats.followers)}</Text><Text style={styles.statLabel}>Followers</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('FollowList', { userId: profile.id, initialTab: 'following', displayName: profile.display_name })}
              accessibilityLabel="View following"
            >
              <Text style={styles.statNum}>{formatCount(stats.following)}</Text><Text style={styles.statLabel}>Following</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Offers')} accessibilityLabel="View your perks">
              <Text style={styles.statNum}>🔥 {profile.current_streak}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </Pressable>
          </View>
          <Pressable style={styles.perksRow} onPress={() => navigation.navigate('Offers')} accessibilityLabel="View your perks">
            <Feather name="gift" size={13} color={colors.coral} />
            <Text style={styles.perksRowText}>View your perks</Text>
            <Feather name="chevron-right" size={13} color={colors.inkSoft} />
          </Pressable>

          {interestChips.length > 0 && (
            <View style={styles.chipRow}>
              {interestChips.map((chip) => (
                <View key={chip.key} style={styles.chip}>
                  <Feather name={interestIcon(chip.key)} size={11} color={colors.coral} />
                  <Text style={styles.chipText}>{chip.label}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.tabRow}>
            {GRID_TABS.map((tab) => (
              <Pressable key={tab.key} style={styles.tab} onPress={() => { haptics.tap(); setActiveTab(tab.key); }}>
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
                {activeTab === tab.key && <View style={styles.tabUnderline} />}
              </Pressable>
            ))}
          </View>
        </View>
      }
      ListFooterComponent={
        <>
          <View style={{ height: 24 }} />
          <ActionSheet
            visible={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            title="Delete this post?"
            message="This can't be undone — it'll remove the post along with its likes and comments."
            actions={[{ label: 'Delete', destructive: true, onPress: confirmDeletePost }]}
          />
        </>
      }
    />
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingHorizontal: 0, marginTop: 20 },
  skeletonGridCell: { width: '33%', aspectRatio: 1 / 1.15, borderRadius: 0 },
  cover: { height: 110 },
  settingsBtn: {
    position: 'absolute', right: 16, width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginTop: -38 },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.sand },
  editBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, marginBottom: 6 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  name: { fontFamily: 'Fraunces_600SemiBold', fontSize: 20, color: colors.ink, paddingHorizontal: spacing.lg, paddingTop: 12 },
  handle: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 12.5, color: colors.inkSoft, paddingHorizontal: spacing.lg, marginTop: 2 },
  bio: { fontSize: 13, color: colors.inkSoft, paddingHorizontal: spacing.lg, marginTop: 10, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 22, paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 6 },
  statNum: { fontSize: 16, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 10.5, color: colors.inkSoft, fontWeight: '600', marginTop: 2 },
  perksRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingTop: 10 },
  perksRowText: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.ink },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.coralSoft },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.coral },
  tabRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, marginTop: 6 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  tabTextActive: { color: colors.ink },
  tabUnderline: { position: 'absolute', bottom: -1, height: 2, width: '60%', backgroundColor: colors.coral, borderRadius: 1 },
  gridCell: { flex: 1, aspectRatio: 1 / 1.15, overflow: 'hidden', marginBottom: 2 },
  gridEmpty: { color: colors.inkSoft, textAlign: 'center', paddingVertical: 40, fontSize: 13 },
  });
}
