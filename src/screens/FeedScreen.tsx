import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing, gradients } from '@/theme/tokens';
import type { Post } from '@/types';
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
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const fetchPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from('posts')
      // Explicit FK hint (posts_author_id_fkey) because post_likes creates a second,
      // indirect posts<->profiles path that makes the relationship ambiguous otherwise.
      .select('*, author:profiles!posts_author_id_fkey(*)')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (error) { console.error('Failed to fetch posts:', error.message); return; }
    setPosts((data as unknown as Post[]) ?? []);
  }, []);

  // Refetches every time Feed regains focus (not just on mount) so a post
  // made in CreatePost, or a like toggled in PostDetail, shows up immediately
  // without needing a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (!hasLoadedOnce) setLoading(true);
        await fetchPosts();
        setLoading(false);
        setHasLoadedOnce(true);
      })();
    }, [fetchPosts, hasLoadedOnce])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await fetchPosts(); setRefreshing(false);
  }, [fetchPosts]);

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
      colHeights[shortest] += estimateCardHeight(post, 130 + (hashString(post.id) % 90));
    }
    return cols;
  }, [posts]);

  const renderCard = (item: Post) => {
    const hash = hashString(item.id);
    const [from, to] = gradients[hash % gradients.length];
    const imageHeight = 130 + (hash % 90);
    return (
      <Pressable
        key={item.id}
        style={[styles.card, item.is_editorial && styles.cardEditorial]}
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
      >
        <View style={[styles.cardImage, { height: imageHeight }]}>
          <LinearGradient colors={[from, to]} style={StyleSheet.absoluteFill} />
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : null}
          {item.is_editorial && (
            <View style={styles.editorialBadge}><Text style={styles.editorialBadgeText}>★ Havenly Picks</Text></View>
          )}
          {item.video_url && (
            <View style={styles.playBadge}><Feather name="play" size={14} color="white" /></View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTag}>{item.tag}</Text>
          <Text style={styles.cardTitle} numberOfLines={3}>{item.title}</Text>
          <View style={styles.cardMeta}>
            <Text style={styles.cardUser} numberOfLines={1}>
              {item.is_editorial ? 'Havenly Editorial' : `@${item.author?.username ?? 'user'}`}
            </Text>
            <View style={styles.cardLikesRow}>
              <Feather name="heart" size={11} color={colors.inkSoft} />
              <Text style={styles.cardLikes}>{item.like_count}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color={colors.coral} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brand}>havenly.</Text>
        </View>
        <View style={styles.topBarActions}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Communities')}>
            <Feather name="users" size={17} color={colors.ink} />
          </Pressable>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
      >
        {posts.length === 0 ? (
          <View style={styles.centered}><Text style={{ color: colors.inkSoft }}>No posts yet — seed editorial content first.</Text></View>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: 60, paddingBottom: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral },
  brand: { fontFamily: 'Fraunces_700Bold_Italic', fontSize: 24, color: colors.ink },
  topBarActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  masonryRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  masonryColumn: { flex: 1, gap: spacing.sm },
  card: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  cardEditorial: { borderColor: colors.gold, borderWidth: 1.5 },
  cardImage: { justifyContent: 'flex-start' },
  editorialBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.ink, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  editorialBadgeText: { color: colors.gold, fontSize: 9, fontWeight: '700' },
  playBadge: {
    position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { padding: 11 },
  cardTag: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 9.5, color: colors.teal, textTransform: 'uppercase' },
  cardTitle: { fontSize: 13.5, fontWeight: '700', marginTop: 5, color: colors.ink, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 },
  cardUser: { fontSize: 11, color: colors.inkSoft, fontWeight: '600', flex: 1 },
  cardLikesRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardLikes: { fontSize: 11, color: colors.inkSoft, fontWeight: '600' },
});
