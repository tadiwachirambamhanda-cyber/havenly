import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing, gradients } from '@/theme/tokens';
import type { Post } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const PAGE_SIZE = 20;

export default function FeedScreen() {
  const navigation = useNavigation<Nav>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => { setLoading(true); fetchPosts().finally(() => setLoading(false)); }, [fetchPosts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true); await fetchPosts(); setRefreshing(false);
  }, [fetchPosts]);

  const renderCard = ({ item, index }: { item: Post; index: number }) => {
    const [from, to] = gradients[index % gradients.length];
    return (
      <Pressable
        style={[styles.card, item.is_editorial && styles.cardEditorial]}
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
      >
        <View style={styles.cardImage}>
          <LinearGradient colors={[from, to]} style={StyleSheet.absoluteFill} />
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : null}
          {item.is_editorial && (
            <View style={styles.editorialBadge}><Text style={styles.editorialBadgeText}>★ Havenly Picks</Text></View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTag}>{item.tag}</Text>
          <Text style={styles.cardTitle} numberOfLines={3}>{item.title}</Text>
          <View style={styles.cardMeta}>
            <Text style={styles.cardUser} numberOfLines={1}>
              {item.is_editorial ? 'Havenly Editorial' : `@${item.author?.username ?? 'user'}`}
            </Text>
            <Text style={styles.cardLikes}>♥ {item.like_count}</Text>
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
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Communities')}><Text>👥</Text></Pressable>
        </View>
      </View>
      <FlatList
        data={posts} key="two-col" numColumns={2} keyExtractor={(item) => item.id} renderItem={renderCard}
        columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
        ListEmptyComponent={<View style={styles.centered}><Text style={{ color: colors.inkSoft }}>No posts yet — seed editorial content first.</Text></View>}
      />
    </View>
  );
}

// NOTE: True masonry (variable card heights) needs a library like
// `@react-native-masonry-list` — FlatList's numColumns alone gives equal-height rows.

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral },
  brand: { fontFamily: 'Fraunces_700Bold', fontStyle: 'italic', fontSize: 24, color: colors.ink },
  topBarActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  card: { flex: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  cardEditorial: { borderColor: colors.gold, borderWidth: 1.5 },
  cardImage: { height: 160, justifyContent: 'flex-start' },
  editorialBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.ink, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  editorialBadgeText: { color: colors.gold, fontSize: 9, fontWeight: '700' },
  cardBody: { padding: 11 },
  cardTag: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 9.5, color: colors.teal, textTransform: 'uppercase' },
  cardTitle: { fontSize: 13.5, fontWeight: '700', marginTop: 5, color: colors.ink, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 },
  cardUser: { fontSize: 11, color: colors.inkSoft, fontWeight: '600', flex: 1 },
  cardLikes: { fontSize: 11, color: colors.inkSoft, fontWeight: '600' },
});
