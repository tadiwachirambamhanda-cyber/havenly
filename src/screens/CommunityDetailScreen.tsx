import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { haptics } from '@/lib/haptics';
import { gradients, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import { communityIcon } from '@/constants/topicIcons';
import { formatCount } from '@/utils/formatCount';
import EmptyState from '@/components/EmptyState';
import VideoThumb from '@/components/VideoThumb';
import type { Community, Post } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'CommunityDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function CommunityDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { communityId } = route.params;
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [community, setCommunity] = useState<Community | null>(null);
  const [joined, setJoined] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const userId = session?.user.id;

    const { data } = await supabase.from('communities').select('*').eq('id', communityId).single();
    setCommunity(data as Community);
    setLoaded(true);

    const { data: postData } = await supabase.from('posts')
      .select('*, author:profiles!posts_author_id_fkey(*)')
      .eq('community_id', communityId).order('created_at', { ascending: false });
    setPosts((postData as unknown as Post[]) ?? []);

    if (userId) {
      const { data: memberRow } = await supabase.from('community_members').select('*')
        .eq('community_id', communityId).eq('user_id', userId).maybeSingle();
      setJoined(!!memberRow);
    }
  }, [communityId, session]);

  // Refetches on focus so a post just made (via the "New post" button below,
  // which navigates away to CreatePost) shows up on return without a manual pull.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggleJoin = async () => {
    const userId = session?.user.id;
    if (!userId || !community) return;
    const wasJoined = joined;
    haptics.tap();
    setJoined(!wasJoined);
    setCommunity((prev) => prev && { ...prev, member_count: prev.member_count + (wasJoined ? -1 : 1) });

    const { error } = wasJoined
      ? await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', userId)
      : await supabase.from('community_members').insert({ community_id: communityId, user_id: userId });

    if (error) {
      // Revert the optimistic update if the write actually failed.
      setJoined(wasJoined);
      setCommunity((prev) => prev && { ...prev, member_count: prev.member_count + (wasJoined ? 1 : -1) });
    }
  };

  if (!community) {
    return loaded ? (
      <View style={styles.notFound}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={17} color={colors.ink} />
        </Pressable>
        <Text style={styles.notFoundText}>This community isn't available.</Text>
      </View>
    ) : (
      <View style={styles.centered}><ActivityIndicator color={colors.coral} /></View>
    );
  }

  // Campus communities are restricted to students of that specific
  // university (enforced for real by the join RLS policy) — this only gates
  // the *join* action. Someone already a member (e.g. before this existed,
  // or after changing their university) can still see the button as "Joined"
  // and leave normally.
  const canJoin = joined || community.category !== 'campus' || profile?.university === community.related_university;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
    >
      <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
        <Feather name="arrow-left" size={17} color={colors.ink} />
      </Pressable>
      <View style={styles.body}>
        <View style={styles.iconChip}>
          <Feather name={communityIcon(community)} size={28} color={colors.teal} />
        </View>
        <Text style={styles.name}>{community.name}</Text>
        <Text style={styles.members}>{formatCount(community.member_count)} members</Text>
        <Text style={styles.desc}>{community.description}</Text>
        {canJoin ? (
          <Pressable
            style={[styles.joinBtn, joined && styles.joinBtnJoined]}
            onPress={toggleJoin}
            accessibilityLabel={joined ? 'Leave community' : 'Join community'}
          >
            <Text style={[styles.joinBtnText, joined && styles.joinBtnTextJoined]}>{joined ? 'Joined ✓' : 'Join community'}</Text>
          </Pressable>
        ) : profile?.university ? (
          <View style={styles.restrictedBox}>
            <Feather name="lock" size={13} color={colors.inkSoft} />
            <Text style={styles.restrictedText}>This community is for {community.related_university} students.</Text>
          </View>
        ) : (
          <Pressable style={styles.restrictedBox} onPress={() => navigation.navigate('EditProfile')}>
            <Feather name="lock" size={13} color={colors.inkSoft} />
            <Text style={styles.restrictedText}>Set your university in Edit Profile to join this community.</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.feedHeader}>
        <Text style={styles.feedLabel}>Posts</Text>
        {joined && (
          <Pressable style={styles.newPostBtn} onPress={() => navigation.navigate('CreatePost', { communityId })}>
            <Feather name="plus" size={13} color={colors.coral} />
            <Text style={styles.newPostBtnText}>New post</Text>
          </Pressable>
        )}
      </View>

      {posts.length === 0 ? (
        <EmptyState icon="image" text={joined ? 'No posts yet — be the first to post here.' : 'No posts yet in this community.'} />
      ) : (
        posts.map((post) => {
          const [from, to] = gradients[post.id.charCodeAt(0) % gradients.length];
          return (
            <Pressable key={post.id} style={styles.postCard} onPress={() => navigation.navigate('PostDetail', { postId: post.id })}>
              <View style={styles.postImage}>
                <LinearGradient colors={[from, to]} style={StyleSheet.absoluteFill} />
                {post.video_url ? (
                  <VideoThumb uri={post.video_url} />
                ) : post.image_url ? (
                  <Image source={{ uri: post.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                ) : null}
                {post.video_url && (
                  <View style={styles.playBadge}><Feather name="volume-x" size={9} color="white" /></View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.postTag}>{post.tag}</Text>
                <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
                <View style={styles.postMeta}>
                  <Text style={styles.postUser} numberOfLines={1}>
                    {post.is_editorial ? 'Havenly Editorial' : `@${post.author?.username ?? 'user'}`}
                  </Text>
                  <View style={styles.postLikes}>
                    <Feather name="heart" size={10} color={colors.inkSoft} />
                    <Text style={styles.postLikesText}>{formatCount(post.like_count)}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  centered: { flex: 1, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  back: { marginTop: 50, marginLeft: 16, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  notFound: { flex: 1, backgroundColor: colors.sand, paddingTop: 60, paddingHorizontal: spacing.lg },
  notFoundText: { color: colors.inkSoft, textAlign: 'center', marginTop: 100 },
  body: { padding: spacing.lg },
  iconChip: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: 'Fraunces_600SemiBold', fontSize: 21, color: colors.ink, marginTop: 8 },
  members: { fontSize: 12, color: colors.inkSoft, marginTop: 4 },
  desc: { fontSize: 13, color: colors.inkSoft, lineHeight: 20, marginTop: 12 },
  joinBtn: { marginTop: 16, backgroundColor: colors.coral, paddingVertical: 13, borderRadius: 100, alignItems: 'center' },
  joinBtnJoined: { backgroundColor: colors.ink },
  joinBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  // joinBtn stays coral regardless of theme, so its text stays literal white;
  // joinBtnJoined uses colors.ink (flips to cream in dark mode), so its text
  // needs the paired colors.sand instead to stay readable.
  joinBtnTextJoined: { color: colors.sand },
  restrictedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, backgroundColor: colors.sandDeep,
    paddingVertical: 13, paddingHorizontal: 16, borderRadius: 100,
  },
  restrictedText: { flex: 1, color: colors.inkSoft, fontSize: 12.5, fontWeight: '600' },
  feedHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, marginTop: 8, marginBottom: 10,
  },
  feedLabel: {
    fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft, fontWeight: '600',
  },
  newPostBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  newPostBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.coral },
  emptyText: { color: colors.inkSoft, textAlign: 'center', marginTop: 24, paddingHorizontal: spacing.lg, fontSize: 13 },
  postCard: {
    flexDirection: 'row', gap: 12, marginHorizontal: spacing.lg, marginBottom: 12,
    backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 10, overflow: 'hidden',
  },
  postImage: { width: 66, height: 66, borderRadius: 12, overflow: 'hidden' },
  playBadge: {
    position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  postTag: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 9, color: colors.teal, textTransform: 'uppercase' },
  postTitle: { fontSize: 13, fontWeight: '700', color: colors.ink, marginTop: 3, lineHeight: 17 },
  postMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  postUser: { fontSize: 10.5, color: colors.inkSoft, fontWeight: '600', flex: 1 },
  postLikes: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  postLikesText: { fontSize: 10.5, color: colors.inkSoft, fontWeight: '600' },
  });
}
