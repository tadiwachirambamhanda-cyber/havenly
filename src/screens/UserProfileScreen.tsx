import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, type ViewToken } from 'react-native';
import AnimatedPressable from '@/components/AnimatedPressable';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useNavigation, useRoute, useFocusEffect, useIsFocused, RouteProp } from '@react-navigation/native';
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
import { findOrCreateConversation } from '@/lib/conversations';
import { blockUser, submitReport } from '@/lib/safety';
import { radius, spacing, gradients } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import { INTEREST_OPTIONS } from '@/constants/interests';
import { interestIcon } from '@/constants/topicIcons';
import EmptyState from '@/components/EmptyState';
import VideoThumb from '@/components/VideoThumb';
import ReportModal from '@/components/ReportModal';
import ActionSheet from '@/components/ActionSheet';
import type { Post, Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = RouteProp<RootStackParamList, 'UserProfile'>;

// Read-only counterpart to ProfileScreen — same cover/avatar/stats/grid
// layout, but for someone else: Follow + Message instead of Edit profile,
// no Saved/Tagged tabs (both are private to the profile's own owner, and
// Tagged is a stub everywhere, even on your own profile), and a safety menu
// instead of Settings.
export default function UserProfileScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { userId } = route.params;
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;
  const isMe = userId === myId;
  // The avatar normally overlaps the cover by 38px (see `avatarRow`'s base
  // marginTop below), landing its top edge at 72px down from the cover's
  // start. The back button floats over the cover too, pinned at
  // insets.top + 12 — on a tall-inset device (Dynamic Island etc.) its
  // bottom edge can sit past 72px and collide with the avatar. Only pull
  // the avatar down further when that's actually the case, so the normal
  // 38px overlap look is untouched on ordinary devices.
  const avatarMarginTop = Math.max(-38, insets.top - 52);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [posts, setPosts] = useState<Post[]>([]);
  const [following, setFollowing] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [visibleVideoIds, setVisibleVideoIds] = useState<Set<string>>(new Set());
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [blockConfirmVisible, setBlockConfirmVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    setVisibleVideoIds(new Set(viewableItems.map((vi) => vi.item.id)));
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const load = useCallback(async () => {
    const [{ data: profileData }, { count: postCount }, { count: followerCount }, { count: followingCount }, { data: postData }, { data: followRow }] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
        supabase.from('posts').select('*, author:profiles!posts_author_id_fkey(*)').eq('author_id', userId).order('created_at', { ascending: false }),
        myId && myId !== userId
          ? supabase.from('follows').select('*').eq('follower_id', myId).eq('following_id', userId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

    // A null profile here can legitimately mean "blocked" (RLS hides posts
    // between blocked users, but the profile row itself is still visible —
    // only a genuinely missing/deleted account looks like this).
    if (!profileData) { setNotFound(true); return; }
    setProfile(profileData as Profile);
    setStats({ posts: postCount ?? 0, followers: followerCount ?? 0, following: followingCount ?? 0 });
    setPosts((postData as unknown as Post[]) ?? []);
    setFollowing(!!followRow);
  }, [userId, myId]);

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

  const toggleFollow = async () => {
    if (!myId || isMe) return;
    haptics.tap();
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    setStats((prev) => ({ ...prev, followers: Math.max(prev.followers + (wasFollowing ? -1 : 1), 0) }));
    const { error } = wasFollowing
      ? await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', userId)
      : await supabase.from('follows').insert({ follower_id: myId, following_id: userId });
    if (error) {
      // Revert the optimistic update if the write actually failed.
      setFollowing(wasFollowing);
      setStats((prev) => ({ ...prev, followers: Math.max(prev.followers + (wasFollowing ? 1 : -1), 0) }));
    }
  };

  const onMessage = async () => {
    if (!myId || isMe || messaging) return;
    setMessaging(true);
    try {
      const conversationId = await findOrCreateConversation(myId, userId);
      navigation.navigate('Chat', { conversationId, otherUserId: userId });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t start conversation.', 'error');
    } finally {
      setMessaging(false);
    }
  };

  const confirmBlock = async () => {
    if (!myId) return;
    try {
      await blockUser(myId, userId);
      haptics.success();
      navigation.goBack();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t block. Try again.', 'error');
    }
  };

  const handleReportSubmit = async (reason: string) => {
    setReportModalVisible(false);
    if (!myId) return;
    try {
      await submitReport(myId, 'user', userId, reason);
      showToast('Thanks — we’ve got your report.');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t submit report.', 'error');
    }
  };

  if (notFound) {
    return (
      <View style={styles.notFound}>
        <AnimatedPressable style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={17} color={colors.ink} />
        </AnimatedPressable>
        <Text style={styles.notFoundText}>This account isn’t available.</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.coral} />
      </View>
    );
  }

  const interestChips = INTEREST_OPTIONS.filter((opt) => profile.interests.includes(opt.key));

  return (
    <>
      <FlatList
        style={styles.container}
        data={posts}
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
            <Animated.View entering={FadeIn.delay(Math.min(index, 11) * 30)} style={styles.gridCell}>
            <AnimatedPressable style={{ flex: 1 }} onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
              <LinearGradient colors={[from, to]} style={StyleSheet.absoluteFill} />
              {item.video_url ? (
                <VideoThumb uri={item.video_url} isVisible={isFocused && visibleVideoIds.has(item.id)} />
              ) : item.image_url ? (
                <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              ) : null}
            </AnimatedPressable>
            </Animated.View>
          );
        }}
        ListEmptyComponent={hasLoadedOnce ? <EmptyState icon="grid" text="No posts yet." /> : null}
        ListHeaderComponent={
          <View>
            {profile.cover_url ? (
              <Image source={{ uri: profile.cover_url }} style={styles.cover} contentFit="cover" transition={200} />
            ) : (
              <LinearGradient colors={['#FF7A5C', '#E3A23A', '#0F8B82']} locations={[0, 0.6, 1]} style={styles.cover} />
            )}
            <AnimatedPressable style={[styles.back, styles.backOverlay, { top: insets.top + 12 }]} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
              <Feather name="arrow-left" size={17} color="#20261F" />
            </AnimatedPressable>
            {!isMe && (
              <AnimatedPressable
                style={[styles.overflowBtn, { top: insets.top + 12 }]}
                onPress={() => setOptionsVisible(true)}
                accessibilityLabel="More options"
              >
                <Feather name="more-horizontal" size={17} color="#20261F" />
              </AnimatedPressable>
            )}
            <View style={[styles.avatarRow, { marginTop: avatarMarginTop }]}>
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} transition={200} />
              ) : (
                <LinearGradient colors={['#0F8B82', '#FF5A3C']} style={styles.avatar} />
              )}
              {!isMe && (
                <View style={styles.actionRow}>
                  <AnimatedPressable style={styles.messageBtn} onPress={onMessage} disabled={messaging} accessibilityLabel="Message">
                    <Feather name="message-circle" size={15} color={colors.ink} />
                  </AnimatedPressable>
                  <AnimatedPressable
                    style={[styles.followBtn, following && styles.followBtnActive]}
                    onPress={toggleFollow}
                    accessibilityLabel={following ? `Unfollow ${profile.display_name}` : `Follow ${profile.display_name}`}
                  >
                    <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
                      {following ? 'Following' : 'Follow'}
                    </Text>
                  </AnimatedPressable>
                </View>
              )}
            </View>

            <Text style={styles.name}>{profile.display_name}</Text>
            <Text style={styles.handle}>@{profile.username}{profile.university ? ` · ${profile.university}` : ''}</Text>
            {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

            <View style={styles.statsRow}>
              <View><Text style={styles.statNum}>{formatCount(stats.posts)}</Text><Text style={styles.statLabel}>Posts</Text></View>
              <AnimatedPressable
                onPress={() => navigation.navigate('FollowList', { userId: profile.id, initialTab: 'followers', displayName: profile.display_name })}
                accessibilityLabel="View followers"
              >
                <Text style={styles.statNum}>{formatCount(stats.followers)}</Text><Text style={styles.statLabel}>Followers</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => navigation.navigate('FollowList', { userId: profile.id, initialTab: 'following', displayName: profile.display_name })}
                accessibilityLabel="View following"
              >
                <Text style={styles.statNum}>{formatCount(stats.following)}</Text><Text style={styles.statLabel}>Following</Text>
              </AnimatedPressable>
              <View>
                <Text style={styles.statNum}>🔥 {profile.current_streak}</Text>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
            </View>

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

            <Text style={styles.sectionLabel}>Posts</Text>
          </View>
        }
      />
      <ReportModal visible={reportModalVisible} onClose={() => setReportModalVisible(false)} onSubmit={handleReportSubmit} />
      <ActionSheet
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        actions={[
          { label: 'Report user', onPress: () => setReportModalVisible(true) },
          { label: `Block @${profile.username}`, destructive: true, onPress: () => setBlockConfirmVisible(true) },
        ]}
      />
      <ActionSheet
        visible={blockConfirmVisible}
        onClose={() => setBlockConfirmVisible(false)}
        title={`Block @${profile.username}?`}
        message="They won't be able to message you or see each other's posts anymore."
        actions={[{ label: 'Block', destructive: true, onPress: confirmBlock }]}
      />
    </>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  centered: { flex: 1, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  notFound: { flex: 1, backgroundColor: colors.sand, paddingTop: 60, paddingHorizontal: spacing.lg },
  notFoundText: { color: colors.inkSoft, textAlign: 'center', marginTop: 100 },
  cover: { height: 110 },
  back: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  backOverlay: { position: 'absolute', left: 16, backgroundColor: 'rgba(255,255,255,0.9)' },
  overflowBtn: {
    position: 'absolute', right: 16, width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginTop: -38 },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.sand },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  messageBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line,
  },
  followBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.ink },
  followBtnActive: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line },
  followBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.sand },
  followBtnTextActive: { color: colors.ink },
  name: { fontFamily: 'Fraunces_600SemiBold', fontSize: 20, color: colors.ink, paddingHorizontal: spacing.lg, paddingTop: 12 },
  handle: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 12.5, color: colors.inkSoft, paddingHorizontal: spacing.lg, marginTop: 2 },
  bio: { fontSize: 13, color: colors.inkSoft, paddingHorizontal: spacing.lg, marginTop: 10, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 22, paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 6 },
  statNum: { fontSize: 16, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 10.5, color: colors.inkSoft, fontWeight: '600', marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.coralSoft },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.coral },
  sectionLabel: {
    fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft,
    fontWeight: '600', paddingHorizontal: spacing.lg, marginTop: 6, marginBottom: 10,
  },
  gridCell: { flex: 1, aspectRatio: 1 / 1.15, overflow: 'hidden', marginBottom: 2 },
  });
}
