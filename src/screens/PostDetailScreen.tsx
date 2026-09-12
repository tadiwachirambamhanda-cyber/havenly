import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Share } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { colors, gradients, spacing } from '@/theme/tokens';
import type { Post } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'PostDetail'>;

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function PostDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { session } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(false);

  const load = useCallback(async () => {
    // Explicit FK hint (posts_author_id_fkey) — see FeedScreen.tsx for why it's needed.
    const { data } = await supabase.from('posts').select('*, author:profiles!posts_author_id_fkey(*)')
      .eq('id', route.params.postId).single();
    setPost(data as unknown as Post);

    const userId = session?.user.id;
    if (!userId || !data) return;

    const [{ data: likeRow }, { data: followRow }] = await Promise.all([
      supabase.from('post_likes').select('*').eq('post_id', route.params.postId).eq('user_id', userId).maybeSingle(),
      supabase.from('follows').select('*').eq('follower_id', userId).eq('following_id', data.author_id).maybeSingle(),
    ]);
    setLiked(!!likeRow);
    setFollowing(!!followRow);
  }, [route.params.postId, session]);

  useEffect(() => { load(); }, [load]);

  const toggleLike = async () => {
    if (!post) return;
    setLiked((prev) => !prev);
    setPost((prev) => prev && { ...prev, like_count: prev.like_count + (liked ? -1 : 1) });
    const { data, error } = await supabase.rpc('toggle_post_like', { post_id_input: post.id });
    if (error) { console.error('Failed to toggle like:', error.message); return; }
    const result = data?.[0];
    if (result) {
      setLiked(result.liked);
      setPost((prev) => prev && { ...prev, like_count: result.like_count });
    }
  };

  const toggleFollow = async () => {
    if (!post || !session?.user) return;
    if (following) {
      await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', post.author_id);
    } else {
      await supabase.from('follows').insert({ follower_id: session.user.id, following_id: post.author_id });
    }
    setFollowing(!following);
  };

  const onShare = () => {
    if (!post) return;
    Share.share({ message: `${post.title} — via Havenly` }).catch(() => {});
  };

  if (!post) return null;

  const isOwnPost = post.author_id === session?.user.id;
  const [heroFrom, heroTo] = gradients[post.id.charCodeAt(0) % gradients.length];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        <LinearGradient colors={[heroFrom, heroTo]} style={StyleSheet.absoluteFill} />
        {post.image_url && <Image source={{ uri: post.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" />}
        <Pressable style={styles.back} onPress={() => navigation.goBack()}><Text>←</Text></Pressable>
      </View>
      <View style={styles.body}>
        <Text style={styles.tag}>{post.tag}</Text>
        <Text style={styles.title}>{post.title}</Text>

        <View style={styles.userRow}>
          {post.author?.avatar_url ? (
            <Image source={{ uri: post.author.avatar_url }} style={styles.avatar} />
          ) : (
            <LinearGradient colors={['#0F8B82', '#FF5A3C']} style={styles.avatar} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.username}>@{post.author?.username ?? 'user'}</Text>
            <Text style={styles.meta}>{timeAgo(post.created_at)}</Text>
          </View>
          {!isOwnPost && (
            <Pressable style={[styles.followBtn, following && styles.followBtnActive]} onPress={toggleFollow}>
              <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
                {following ? 'Following' : 'Follow'}
              </Text>
            </Pressable>
          )}
        </View>

        {post.body ? <Text style={styles.text}>{post.body}</Text> : null}

        <View style={styles.actionBar}>
          <Pressable style={styles.actionItem} onPress={toggleLike}>
            <Text style={styles.actionText}>{liked ? '❤️' : '🤍'} {post.like_count}</Text>
          </Pressable>
          <Pressable style={styles.actionItem} onPress={() => Alert.alert('Coming soon', 'Comments aren\'t built yet.')}>
            <Text style={styles.actionText}>💬</Text>
          </Pressable>
          <Pressable style={styles.actionItem} onPress={onShare}>
            <Text style={styles.actionText}>↗ Share</Text>
          </Pressable>
          <Pressable style={styles.actionItem} onPress={() => Alert.alert('Coming soon', 'Saving posts isn\'t built yet.')}>
            <Text style={styles.actionText}>🔖 Save</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  hero: { width: '100%', height: 340 },
  back: {
    position: 'absolute', top: 16, left: 16, width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: spacing.lg },
  tag: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 10.5, color: colors.teal, textTransform: 'uppercase' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 22, color: colors.ink, marginTop: 8, lineHeight: 28 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 14 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  username: { fontSize: 13, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 11, color: colors.inkSoft },
  followBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100, backgroundColor: colors.ink },
  followBtnActive: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  followBtnText: { fontSize: 11.5, fontWeight: '700', color: colors.sand },
  followBtnTextActive: { color: colors.ink },
  text: { fontSize: 13.5, lineHeight: 22, color: '#3A4038' },
  actionBar: { flexDirection: 'row', gap: 18, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 12.5, fontWeight: '700', color: colors.inkSoft },
});
