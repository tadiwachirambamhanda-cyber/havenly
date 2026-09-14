import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Share, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { findOrCreateConversation } from '@/lib/conversations';
import { blockUser, submitReport } from '@/lib/safety';
import ReportModal from '@/components/ReportModal';
import { gradients, radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import { timeAgo } from '@/utils/timeAgo';
import type { Comment, Post } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'PostDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

// Paused until the viewer taps play (native controls) — no autoplay, so
// opening a post never burns data on its own. This version of expo-video
// has no poster-image prop, so the generated thumbnail is rendered as a
// backdrop behind it (see the hero markup below) for the moment before the
// player has a frame to show.
function PostVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls />;
}

export default function PostDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [post, setPost] = useState<Post | null>(null);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  const loadComments = useCallback(async () => {
    const { data } = await supabase.from('comments').select('*, author:profiles(*)')
      .eq('post_id', route.params.postId).order('created_at', { ascending: true });
    setComments((data as unknown as Comment[]) ?? []);
  }, [route.params.postId]);

  const load = useCallback(async () => {
    // Explicit FK hint (posts_author_id_fkey) — see FeedScreen.tsx for why it's needed.
    // A null result here can legitimately mean "blocked" (RLS hides posts
    // between blocked users), not just "doesn't exist" — same UI either way.
    const { data } = await supabase.from('posts').select('*, author:profiles!posts_author_id_fkey(*)')
      .eq('id', route.params.postId).single();
    setPost(data as unknown as Post);
    setLoaded(true);
    loadComments();

    const userId = session?.user.id;
    if (!userId || !data) return;

    const [{ data: likeRow }, { data: followRow }, { data: savedRow }] = await Promise.all([
      supabase.from('post_likes').select('*').eq('post_id', route.params.postId).eq('user_id', userId).maybeSingle(),
      supabase.from('follows').select('*').eq('follower_id', userId).eq('following_id', data.author_id).maybeSingle(),
      supabase.from('saved_posts').select('*').eq('post_id', route.params.postId).eq('user_id', userId).maybeSingle(),
    ]);
    setLiked(!!likeRow);
    setFollowing(!!followRow);
    setSaved(!!savedRow);
  }, [route.params.postId, session, loadComments]);

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

  const toggleSave = async () => {
    if (!post || !session?.user) return;
    const wasSaved = saved;
    setSaved(!wasSaved);
    const { error } = wasSaved
      ? await supabase.from('saved_posts').delete().eq('user_id', session.user.id).eq('post_id', post.id)
      : await supabase.from('saved_posts').insert({ user_id: session.user.id, post_id: post.id });
    if (error) {
      console.error('Failed to toggle save:', error.message);
      setSaved(wasSaved);
      Alert.alert('Couldn\'t save post', error.message);
    }
  };

  const addComment = async () => {
    if (!post || !session?.user || !commentInput.trim() || postingComment) return;
    setPostingComment(true);
    const body = commentInput.trim();
    setCommentInput('');
    const { data, error } = await supabase.from('comments')
      .insert({ post_id: post.id, author_id: session.user.id, body })
      .select('*, author:profiles(*)').single();
    setPostingComment(false);
    if (error) { Alert.alert('Couldn\'t post comment', error.message); return; }
    setComments((prev) => [...prev, data as unknown as Comment]);
    setPost((prev) => prev && { ...prev, comment_count: prev.comment_count + 1 });
  };

  const deleteComment = (comment: Comment) => {
    Alert.alert('Delete comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('comments').delete().eq('id', comment.id);
          setComments((prev) => prev.filter((c) => c.id !== comment.id));
          setPost((prev) => prev && { ...prev, comment_count: Math.max(prev.comment_count - 1, 0) });
        },
      },
    ]);
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

  const onMessage = async () => {
    if (!post || !session?.user || messaging) return;
    setMessaging(true);
    try {
      const conversationId = await findOrCreateConversation(session.user.id, post.author_id);
      navigation.navigate('Chat', { conversationId, otherUserId: post.author_id });
    } catch (e) {
      Alert.alert('Couldn\'t start conversation', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setMessaging(false);
    }
  };

  const handleBlock = () => {
    if (!post || !session?.user) return;
    Alert.alert(
      `Block @${post.author?.username ?? 'this user'}?`,
      'They won\'t be able to message you or see each other\'s posts anymore.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block', style: 'destructive', onPress: async () => {
            try {
              await blockUser(session.user.id, post.author_id);
              navigation.goBack();
            } catch (e) {
              Alert.alert('Couldn\'t block', e instanceof Error ? e.message : 'Try again.');
            }
          },
        },
      ]
    );
  };

  const openOptions = () => {
    if (!post) return;
    Alert.alert('', undefined, [
      { text: 'Report post', onPress: () => setReportModalVisible(true) },
      { text: `Block @${post.author?.username ?? 'user'}`, style: 'destructive', onPress: handleBlock },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleReportSubmit = async (reason: string) => {
    setReportModalVisible(false);
    if (!post || !session?.user) return;
    try {
      await submitReport(session.user.id, 'post', post.id, reason);
      Alert.alert('Thanks', 'We\'ve got your report.');
    } catch (e) {
      Alert.alert('Couldn\'t submit report', e instanceof Error ? e.message : 'Try again.');
    }
  };

  if (!post) {
    return loaded ? (
      <View style={styles.notFound}>
        <Pressable style={[styles.back, { top: insets.top + 12 }]} onPress={() => navigation.goBack()}><Feather name="arrow-left" size={16} color="#20261F" /></Pressable>
        <Text style={styles.notFoundText}>This post isn't available.</Text>
      </View>
    ) : null;
  }

  const isOwnPost = post.author_id === session?.user.id;
  const [heroFrom, heroTo] = gradients[post.id.charCodeAt(0) % gradients.length];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
    <View style={styles.container}>
    <ScrollView>
      <View style={styles.hero}>
        <LinearGradient colors={[heroFrom, heroTo]} style={StyleSheet.absoluteFill} />
        {post.image_url && <Image source={{ uri: post.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" />}
        {post.video_url && <PostVideo uri={post.video_url} />}
        <Pressable style={[styles.back, { top: insets.top + 12 }]} onPress={() => navigation.goBack()}><Feather name="arrow-left" size={16} color="#20261F" /></Pressable>
        {!isOwnPost && (
          <Pressable style={[styles.overflow, { top: insets.top + 12 }]} onPress={openOptions}><Feather name="more-horizontal" size={17} color="#20261F" /></Pressable>
        )}
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
            <Text style={styles.username}>{post.is_editorial ? 'Havenly Editorial' : `@${post.author?.username ?? 'user'}`}</Text>
            <Text style={styles.meta}>{timeAgo(post.created_at)}</Text>
          </View>
          {!isOwnPost && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={styles.messageBtn} onPress={onMessage}>
                <Feather name="message-circle" size={14} color={colors.ink} />
              </Pressable>
              <Pressable style={[styles.followBtn, following && styles.followBtnActive]} onPress={toggleFollow}>
                <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
                  {following ? 'Following' : 'Follow'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {post.body ? <Text style={styles.text}>{post.body}</Text> : null}

        <View style={styles.actionBar}>
          <Pressable style={styles.actionItem} onPress={toggleLike}>
            <Feather name="heart" size={15} color={liked ? colors.coral : colors.inkSoft} />
            <Text style={[styles.actionText, liked && styles.actionTextActive]}>{post.like_count}</Text>
          </Pressable>
          <View style={styles.actionItem}>
            <Feather name="message-circle" size={15} color={colors.inkSoft} />
            <Text style={styles.actionText}>{post.comment_count}</Text>
          </View>
          <Pressable style={styles.actionItem} onPress={onShare}>
            <Feather name="share-2" size={15} color={colors.inkSoft} />
            <Text style={styles.actionText}>Share</Text>
          </Pressable>
          <Pressable style={styles.actionItem} onPress={toggleSave}>
            <Feather name="bookmark" size={15} color={saved ? colors.coral : colors.inkSoft} />
            <Text style={[styles.actionText, saved && styles.actionTextActive]}>{saved ? 'Saved' : 'Save'}</Text>
          </Pressable>
        </View>

        <View style={styles.commentsSection}>
          <Text style={styles.commentsLabel}>Comments</Text>
          {comments.map((comment) => (
            <Pressable
              key={comment.id}
              style={styles.commentRow}
              onLongPress={() => comment.author_id === session?.user.id && deleteComment(comment)}
            >
              {comment.author?.avatar_url ? (
                <Image source={{ uri: comment.author.avatar_url }} style={styles.commentAvatar} />
              ) : (
                <LinearGradient colors={['#0F8B82', '#FF5A3C']} style={styles.commentAvatar} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.commentMeta}>
                  <Text style={styles.commentUser}>@{comment.author?.username ?? 'user'}</Text> · {timeAgo(comment.created_at)}
                </Text>
                <Text style={styles.commentBody}>{comment.body}</Text>
              </View>
            </Pressable>
          ))}
          {comments.length === 0 && <Text style={styles.noComments}>No comments yet — be the first.</Text>}
        </View>
      </View>
      <ReportModal visible={reportModalVisible} onClose={() => setReportModalVisible(false)} onSubmit={handleReportSubmit} />
    </ScrollView>
    <View style={styles.commentInputRow}>
      <TextInput
        style={styles.commentInput}
        placeholder="Add a comment…"
        placeholderTextColor={colors.inkSoft}
        value={commentInput}
        onChangeText={setCommentInput}
        onSubmitEditing={addComment}
      />
      <Pressable style={styles.commentSendBtn} onPress={addComment}><Feather name="send" size={15} color={colors.sand} /></Pressable>
    </View>
    </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  hero: { width: '100%', height: 340 },
  back: {
    position: 'absolute', top: 16, left: 16, width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  overflow: {
    position: 'absolute', top: 16, right: 16, width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
  },
  notFound: { flex: 1, backgroundColor: colors.sand, paddingTop: 60, paddingHorizontal: spacing.lg },
  notFoundText: { color: colors.inkSoft, textAlign: 'center', marginTop: 100 },
  body: { padding: spacing.lg },
  tag: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 10.5, color: colors.teal, textTransform: 'uppercase' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 22, color: colors.ink, marginTop: 8, lineHeight: 28 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 14 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  username: { fontSize: 13, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 11, color: colors.inkSoft },
  messageBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  followBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100, backgroundColor: colors.ink },
  followBtnActive: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  followBtnText: { fontSize: 11.5, fontWeight: '700', color: colors.sand },
  followBtnTextActive: { color: colors.ink },
  text: { fontSize: 13.5, lineHeight: 22, color: colors.inkSoft },
  actionBar: { flexDirection: 'row', gap: 18, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 12.5, fontWeight: '700', color: colors.inkSoft },
  actionTextActive: { color: colors.coral },
  commentsSection: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.line },
  commentsLabel: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft, marginBottom: 12 },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  commentAvatar: { width: 28, height: 28, borderRadius: 14 },
  commentMeta: { fontSize: 11, color: colors.inkSoft },
  commentUser: { fontWeight: '700', color: colors.ink },
  commentBody: { fontSize: 13, color: colors.inkSoft, marginTop: 3, lineHeight: 18 },
  noComments: { fontSize: 12.5, color: colors.inkSoft },
  commentInputRow: { flexDirection: 'row', gap: 9, alignItems: 'center', padding: spacing.md, borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.sand },
  commentInput: { flex: 1, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 11, fontSize: 13, color: colors.ink },
  commentSendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  });
}
