import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { radius, spacing, gradients } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import { communityIcon } from '@/constants/topicIcons';
import { formatCount } from '@/utils/formatCount';
import EmptyState from '@/components/EmptyState';
import Skeleton from '@/components/Skeleton';
import VideoThumb from '@/components/VideoThumb';
import type { Community, Post } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const PAGE_SIZE = 20;
const NUM_COLUMNS = 2;

// Deterministic per-post hash (not random per render) so a card's image
// height and gradient stay stable across refreshes/refetches instead of
// reshuffling the whole layout every time.
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return hash;
}

// Rough estimate of a card's total rendered height (image + text body) used
// only to balance which column an item goes into — doesn't need to be exact,
// just consistent enough that columns end up close in length.
function estimateCardHeight(post: Post, imageHeight: number): number {
  const titleLines = post.title.length < 28 ? 1 : post.title.length < 56 ? 2 : 3;
  return imageHeight + 64 + titleLines * 18;
}

export default function FeedScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const fetchPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      // Explicit FK hint (posts_author_id_fkey) because post_likes creates a second,
      // indirect posts<->profiles path that makes the relationship ambiguous otherwise.
      .select('*, author:profiles!posts_author_id_fkey(*), community:communities(name)')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (error) { console.error('Failed to fetch posts:', error.message); return; }
    setPosts((data as unknown as Post[]) ?? []);
  }, []);

  const fetchMyCommunities = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) { setMyCommunities([]); return; }
    const { data } = await supabase.from('community_members').select('community:communities(*)').eq('user_id', userId);
    setMyCommunities(((data ?? []) as unknown as { community: Community }[]).map((r) => r.community));
  }, [session]);

  // Refetches every time Feed regains focus (not just on mount) so a post
  // made in CreatePost, or a like toggled in PostDetail, shows up immediately
  // without needing a manual pull-to-refresh. Same for community membership —
  // joining/leaving in Communities should update this row without a restart.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (!hasLoadedOnce) setLoading(true);
        await Promise.all([fetchPosts(), fetchMyCommunities()]);
        setLoading(false);
        setHasLoadedOnce(true);
      })();
    }, [fetchPosts, fetchMyCommunities, hasLoadedOnce])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await Promise.all([fetchPosts(), fetchMyCommunities()]); setRefreshing(false);
  }, [fetchPosts, fetchMyCommunities]);

  // True masonry: each post gets a deterministic (not fixed) image height,
  // then a greedy shortest-column-first pass balances posts across columns
  // by estimated total height — plain FlatList numColumns forces equal-height
  // rows, which is what made this not-actually-masonry before.
  const columns = useMemo(() => {
    const cols: Post[][] = Array.from({ length: NUM_COLUMNS }, () => []);
    const colHeights = new Array(NUM_COLUMNS).fill(0);
    for (const post of posts) {
      const shortest = colHeights.indexOf(Math.min(...colHeights));
      cols[shortest].push(post);
      colHeights[shortest] += estimateCardHeight(post, 110 + (hashString(post.id) % 60));
    }
    return cols;
  }, [posts]);

  const renderCard = (item: Post) => {
    const hash = hashString(item.id);
    const [from, to] = gradients[hash % gradients.length];
    const imageHeight = 110 + (hash % 60);
    return (
      <Pressable
        key={item.id}
        style={[styles.card, item.is_editorial && styles.cardEditorial]}
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
      >
        <View style={[styles.cardImage, { height: imageHeight }]}>
          <LinearGradient colors={[from, to]} style={StyleSheet.absoluteFill} />
          {item.video_url ? (
            <VideoThumb uri={item.video_url} />
          ) : item.image_url ? (
            <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : null}
          {item.is_editorial && (
            <View style={styles.editorialBadge}><Text style={styles.editorialBadgeText}>★ Havenly Picks</Text></View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTag}>{item.tag}</Text>
          {item.community?.name && (
            <View style={styles.communityBadge}>
              <Feather name="users" size={9} color={colors.teal} />
              <Text style={styles.communityBadgeText} numberOfLines={1}>{item.community.name}</Text>
            </View>
          )}
          <Text style={styles.cardTitle} numberOfLines={3}>{item.title}</Text>
          <View style={styles.cardMeta}>
            <Text style={styles.cardUser} numberOfLines={1}>
              {item.is_editorial ? 'Havenly Editorial' : `@${item.author?.username ?? 'user'}`}
            </Text>
            <View style={styles.cardLikesRow}>
              <Feather name="heart" size={11} color={colors.inkSoft} />
              <Text style={styles.cardLikes}>{formatCount(item.like_count)}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brand}>havenly.</Text>
          </View>
        </View>
        <View style={styles.masonryRow}>
          {[0, 1].map((col) => (
            <View key={col} style={styles.masonryColumn}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.card}>
                  <Skeleton style={{ height: 110 + ((col + i) % 3) * 30, borderRadius: 0 }} />
                  <View style={styles.cardBody}>
                    <Skeleton style={{ height: 9, width: '40%', marginBottom: 8 }} />
                    <Skeleton style={{ height: 13, width: '85%', marginBottom: 6 }} />
                    <Skeleton style={{ height: 13, width: '60%' }} />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brand}>havenly.</Text>
        </View>
        <View style={styles.topBarActions}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Communities')} accessibilityLabel="Communities">
            <Feather name="users" size={17} color={colors.ink} />
          </Pressable>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
      >
        {myCommunities.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.myCommunitiesRow}>
            {myCommunities.map((c) => (
              <Pressable key={c.id} style={styles.myCommunityChip} onPress={() => navigation.navigate('CommunityDetail', { communityId: c.id })}>
                <Feather name={communityIcon(c)} size={12} color={colors.teal} />
                <Text style={styles.myCommunityChipText} numberOfLines={1}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {posts.length === 0 ? (
          <EmptyState icon="image" text="No posts yet — seed editorial content first." />
        ) : (
          <View style={styles.masonryRow}>
            {columns.map((col, i) => (
              <View key={i} style={styles.masonryColumn}>
                {col.map(renderCard)}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: 60, paddingBottom: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral },
  brand: { fontFamily: 'Fraunces_700Bold_Italic', fontSize: 24, color: colors.ink },
  topBarActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  myCommunitiesRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  myCommunityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderWidth: 1,
    borderColor: colors.line, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 12, maxWidth: 160,
  },
  myCommunityChipText: { fontSize: 11.5, fontWeight: '700', color: colors.ink },
  communityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  communityBadgeText: { fontSize: 9.5, fontWeight: '700', color: colors.teal },
  masonryRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  masonryColumn: { flex: 1, gap: spacing.sm },
  card: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  cardEditorial: { borderColor: colors.gold, borderWidth: 1.5 },
  cardImage: { justifyContent: 'flex-start' },
  // Fixed dark plaque regardless of theme — colors.ink would flip to cream in
  // dark mode and break the gold text's contrast, so this one stays literal.
  editorialBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#20261F', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  editorialBadgeText: { color: colors.gold, fontSize: 9, fontWeight: '700' },
  cardBody: { padding: 11 },
  cardTag: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 9.5, color: colors.teal, textTransform: 'uppercase' },
  cardTitle: { fontSize: 13.5, fontWeight: '700', marginTop: 5, color: colors.ink, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 },
  cardUser: { fontSize: 11, color: colors.inkSoft, fontWeight: '600', flex: 1 },
  cardLikesRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardLikes: { fontSize: 11, color: colors.inkSoft, fontWeight: '600' },
  });
}
