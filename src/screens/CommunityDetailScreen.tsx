import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text } from '@/components/Text';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import PhotoPlaceholder from '@/components/PhotoPlaceholder';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { haptics } from '@/lib/haptics';
import { radius, spacing } from '@/theme/tokens';
import { cheapestRoom, formatAed, PERIOD_LABEL } from '@/lib/housing';
import type { ColorTokens } from '@/theme/tokens';
import { communityIcon } from '@/constants/topicIcons';
import { formatCount, formatMembers } from '@/utils/formatCount';
import EmptyState from '@/components/EmptyState';
import Skeleton from '@/components/Skeleton';
import VideoThumb from '@/components/VideoThumb';
import type { Community, Post, Residence } from '@/types';
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
  const [nearbyResidences, setNearbyResidences] = useState<Residence[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const userId = session?.user.id;

    const { data } = await supabase.from('communities').select('*').eq('id', communityId).single();
    setCommunity(data as Community);
    setLoaded(true);

    // A campus community is where students of one university already
    // gather, so it's the natural place to show where they could live.
    const uni = (data as Community | null)?.category === 'campus' ? (data as Community).related_university : null;
    if (uni) {
      const { data: residenceRows } = await supabase.from('residences').select('*, room_types(*)')
        .eq('is_active', true).contains('nearby_universities', [uni]).order('created_at', { ascending: false });
      setNearbyResidences((residenceRows as Residence[]) ?? []);
    } else {
      setNearbyResidences([]);
    }

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
    if (!loaded) {
      return (
        <View style={styles.container}>
          <BackButton style={styles.back}>
            <Icon name="arrow-left" size={17} color={colors.ink} />
          </BackButton>
          <View style={styles.body}>
            <Skeleton style={{ width: 68, height: 68, borderRadius: 34 }} />
            <Skeleton style={{ height: 21, width: '55%', marginTop: 12 }} />
            <Skeleton style={{ height: 12, width: '30%', marginTop: 8 }} />
            <Skeleton style={{ height: 40, width: '100%', marginTop: 16, borderRadius: radius.button }} />
          </View>
          <View style={{ paddingHorizontal: spacing.lg, gap: 14 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                <Skeleton style={{ width: 66, height: 66, borderRadius: radius.sm }} />
                <View style={{ flex: 1, gap: 6, justifyContent: 'center' }}>
                  <Skeleton style={{ height: 10, width: '30%' }} />
                  <Skeleton style={{ height: 14, width: '80%' }} />
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    }
    return (
      <View style={styles.notFound}>
        <BackButton style={styles.back}>
          <Icon name="arrow-left" size={17} color={colors.ink} />
        </BackButton>
        <Text style={styles.notFoundText}>This community isn't available.</Text>
      </View>
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
      <BackButton style={styles.back}>
        <Icon name="arrow-left" size={17} color={colors.ink} />
      </BackButton>
      <View style={styles.body}>
        <View style={styles.iconChip}>
          <Icon name={communityIcon(community)} size={28} color={colors.teal} />
        </View>
        <Text style={styles.name}>{community.name}</Text>
        <Text style={styles.members}>{formatMembers(community.member_count)}</Text>
        <Text style={styles.desc}>{community.description}</Text>
        {canJoin ? (
          <AnimatedPressable
            style={[styles.joinBtn, joined && styles.joinBtnJoined]}
            onPress={toggleJoin}
            accessibilityLabel={joined ? 'Leave community' : 'Join community'}
          >
            <Text style={[styles.joinBtnText, joined && styles.joinBtnTextJoined]}>{joined ? 'Joined' : 'Join community'}</Text>
          </AnimatedPressable>
        ) : profile?.university ? (
          <View style={styles.restrictedBox}>
            <Icon name="lock" size={13} color={colors.inkSoft} />
            <Text style={styles.restrictedText}>This community is for {community.related_university} students.</Text>
          </View>
        ) : (
          <AnimatedPressable style={styles.restrictedBox} onPress={() => navigation.navigate('EditProfile')}>
            <Icon name="lock" size={13} color={colors.inkSoft} />
            <Text style={styles.restrictedText}>Set your university in Edit Profile to join this community.</Text>
          </AnimatedPressable>
        )}
      </View>

      {nearbyResidences.length > 0 && (
        <>
          <View style={styles.feedHeader}>
            <Text style={[styles.feedLabel, { flexShrink: 1, marginRight: 12 }]} numberOfLines={1}>Places to live nearby</Text>
            <AnimatedPressable style={styles.newPostBtn} onPress={() => navigation.navigate('MainTabs', { screen: 'Housing' })}>
              <Text style={styles.newPostBtnText}>See all</Text>
            </AnimatedPressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.residenceRow}>
            {nearbyResidences.map((r) => {
              const room = cheapestRoom(r);
              return (
                <AnimatedPressable
                  key={r.id}
                  style={styles.residenceCard}
                  onPress={() => navigation.navigate('ResidenceDetail', { residenceId: r.id })}
                >
                  <View style={styles.residencePhoto}>
                    {r.photo_urls[0] ? (
                      <Image source={{ uri: r.photo_urls[0] }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                    ) : (
                      <PhotoPlaceholder icon="home" style={StyleSheet.absoluteFill} />
                    )}
                  </View>
                  <View style={{ padding: 10 }}>
                    <Text style={styles.residenceName} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.residencePrice} numberOfLines={1}>
                      {room ? `from ${formatAed(room.price_aed)} / ${PERIOD_LABEL[room.billing_period]}` : 'Currently full'}
                    </Text>
                  </View>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
        </>
      )}

      <View style={styles.feedHeader}>
        <Text style={styles.feedLabel}>Posts</Text>
        {joined && (
          <AnimatedPressable style={styles.newPostBtn} onPress={() => navigation.navigate('CreatePost', { communityId })}>
            <Icon name="plus" size={13} color={colors.coral} />
            <Text style={styles.newPostBtnText}>New post</Text>
          </AnimatedPressable>
        )}
      </View>

      {posts.length === 0 ? (
        <EmptyState icon="image" text={joined ? 'No posts yet. Start the first one.' : 'No posts yet in this community.'} />
      ) : (
        posts.map((post) => {
          return (
            <AnimatedPressable key={post.id} style={styles.postCard} onPress={() => navigation.navigate('PostDetail', { postId: post.id })}>
              {(post.video_url || post.image_url) && (
                <View style={styles.postImage}>
                  {post.video_url ? (
                    <VideoThumb uri={post.video_url} />
                  ) : (
                    <Image source={{ uri: post.image_url! }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                  )}
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.postTag}>{post.tag}</Text>
                <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
                <View style={styles.postMeta}>
                  <AnimatedPressable
                    style={styles.postUserTap}
                    disabled={post.is_editorial}
                    onPress={() => navigation.navigate('UserProfile', { userId: post.author_id })}
                    hitSlop={4}
                  >
                    <Text style={styles.postUser} numberOfLines={1}>
                      {post.is_editorial ? 'Havenly Editorial' : `@${post.author?.username ?? 'user'}`}
                    </Text>
                  </AnimatedPressable>
                  <View style={styles.postLikes}>
                    <Icon name="heart" size={10} color={colors.inkSoft} />
                    <Text style={styles.postLikesText}>{formatCount(post.like_count)}</Text>
                  </View>
                </View>
              </View>
            </AnimatedPressable>
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
  iconChip: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.sandDeep, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: 'Fraunces_600SemiBold', fontSize: 21, color: colors.ink, marginTop: 8 },
  members: { fontSize: 12, color: colors.inkSoft, marginTop: 4 },
  desc: { fontSize: 13, color: colors.inkSoft, lineHeight: 20, marginTop: 12 },
  joinBtn: { marginTop: 16, backgroundColor: colors.coral, paddingVertical: 13, borderRadius: radius.button, alignItems: 'center' },
  joinBtnJoined: { backgroundColor: colors.ink },
  joinBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  // joinBtn stays coral regardless of theme, so its text stays literal white;
  // joinBtnJoined uses colors.ink (flips to cream in dark mode), so its text
  // needs the paired colors.sand instead to stay readable.
  joinBtnTextJoined: { color: colors.sand },
  restrictedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, backgroundColor: colors.sandDeep,
    paddingVertical: 13, paddingHorizontal: 16, borderRadius: radius.button,
  },
  restrictedText: { flex: 1, color: colors.inkSoft, fontSize: 12.5, fontWeight: '600' },
  residenceRow: { gap: 10, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  residenceCard: {
    width: 180, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, overflow: 'hidden',
  },
  residencePhoto: { height: 100, backgroundColor: colors.sandDeep },
  residenceName: { fontSize: 13, fontWeight: '700', color: colors.ink },
  residencePrice: { fontSize: 11.5, color: colors.inkSoft, marginTop: 2 },
  feedHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, marginTop: 8, marginBottom: 10,
  },
  feedLabel: {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.inkSoft,
  },
  newPostBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  newPostBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.coral },
  emptyText: { color: colors.inkSoft, textAlign: 'center', marginTop: 24, paddingHorizontal: spacing.lg, fontSize: 13 },
  postCard: {
    flexDirection: 'row', gap: 12, marginHorizontal: spacing.lg, marginBottom: 12,
    backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: 10, overflow: 'hidden',
  },
  postImage: { width: 66, height: 66, borderRadius: radius.sm, overflow: 'hidden' },
  postTag: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 9, color: colors.teal, textTransform: 'uppercase', letterSpacing: 0.8 },
  postTitle: { fontSize: 13, fontWeight: '700', color: colors.ink, marginTop: 3, lineHeight: 17 },
  postMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  postUserTap: { flex: 1 },
  postUser: { fontSize: 10.5, color: colors.inkSoft, fontWeight: '600' },
  postLikes: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  postLikesText: { fontSize: 10.5, color: colors.inkSoft, fontWeight: '600' },
  });
}
