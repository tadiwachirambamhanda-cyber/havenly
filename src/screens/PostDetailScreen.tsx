import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, TextInput, KeyboardAvoidingView, Platform, Modal } from 'react-native';
// Aliased — this file already uses the classic `Animated` API (react-native)
// for the like-bounce/heart-pop effects; ReanimatedAnimated is only for the
// new scroll-driven parallax hero, which needs a scroll handler that the
// classic API can't do without a separate native listener.
import ReanimatedAnimated from 'react-native-reanimated';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import InitialsAvatar from '@/components/InitialsAvatar';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { formatCount } from '@/utils/formatCount';
import { findOrCreateConversation } from '@/lib/conversations';
import { useParallaxHero } from '@/lib/animations';
import { blockUser, submitReport } from '@/lib/safety';
import ReportModal from '@/components/ReportModal';
import ActionSheet from '@/components/ActionSheet';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import PostVideoPlayer, { type PostVideoPlayerHandle } from '@/components/PostVideoPlayer';
import { gradients, radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import { timeAgo } from '@/utils/timeAgo';
import type { Comment, Post } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'PostDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const HERO_HEIGHT = 340;

export default function PostDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Applied only to the background layer (gradient + video/image), not the
  // back/overflow buttons or the double-tap heart-pop overlay, which stay
  // fixed in place as siblings outside the animated wrapper.
  const { onScroll, heroAnimatedStyle, heroDimStyle } = useParallaxHero(HERO_HEIGHT);
  const lastTapRef = useRef(0);
  const heartPopScale = useRef(new Animated.Value(0.5)).current;
  const heartPopOpacity = useRef(new Animated.Value(0)).current;
  const likeIconScale = useRef(new Animated.Value(1)).current;
  const videoPlayerRef = useRef<PostVideoPlayerHandle>(null);
  const [videoMuted, setVideoMuted] = useState(true);
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
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [blockConfirmVisible, setBlockConfirmVisible] = useState(false);
  const [deleteCommentTarget, setDeleteCommentTarget] = useState<Comment | null>(null);
  const [deletePostConfirmVisible, setDeletePostConfirmVisible] = useState(false);

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

  const playLikeBounce = () => {
    likeIconScale.setValue(1);
    Animated.sequence([
      Animated.spring(likeIconScale, { toValue: 1.35, friction: 3, tension: 200, useNativeDriver: true }),
      Animated.spring(likeIconScale, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true }),
    ]).start();
  };

  const playHeartPop = () => {
    heartPopScale.setValue(0.5);
    heartPopOpacity.setValue(1);
    Animated.sequence([
      Animated.spring(heartPopScale, { toValue: 1.15, friction: 4, tension: 120, useNativeDriver: true }),
      Animated.delay(280),
      Animated.timing(heartPopOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  };

  // Shared by the inline heart button (toggles both ways) and double-tapping
  // the photo (only ever sets liked=true — matches how double-tap works
  // everywhere else, it never unlikes).
  const setLikedState = async (next: boolean) => {
    if (!post || next === liked) return;
    setLiked(next);
    setPost((prev) => prev && { ...prev, like_count: prev.like_count + (next ? 1 : -1) });
    haptics.tap();
    if (next) playLikeBounce();
    const { data, error } = await supabase.rpc('toggle_post_like', { post_id_input: post.id });
    if (error) { console.error('Failed to toggle like:', error.message); return; }
    const result = data?.[0];
    if (result) {
      setLiked(result.liked);
      setPost((prev) => prev && { ...prev, like_count: result.like_count });
    }
  };

  const toggleLike = () => setLikedState(!liked);

  const handleImageTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      playHeartPop();
      setLikedState(true);
    }
    lastTapRef.current = now;
  };

  const toggleSave = async () => {
    if (!post || !session?.user) return;
    const wasSaved = saved;
    setSaved(!wasSaved);
    haptics.tap();
    const { error } = wasSaved
      ? await supabase.from('saved_posts').delete().eq('user_id', session.user.id).eq('post_id', post.id)
      : await supabase.from('saved_posts').insert({ user_id: session.user.id, post_id: post.id });
    if (error) {
      console.error('Failed to toggle save:', error.message);
      setSaved(wasSaved);
      showToast('Couldn’t save post', 'error');
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
    if (error) { showToast('Couldn’t post comment', 'error'); return; }
    haptics.confirm();
    setComments((prev) => [...prev, data as unknown as Comment]);
    setPost((prev) => prev && { ...prev, comment_count: prev.comment_count + 1 });
  };

  const deleteComment = (comment: Comment) => setDeleteCommentTarget(comment);

  const confirmDeleteComment = async () => {
    const comment = deleteCommentTarget;
    if (!comment) return;
    await supabase.from('comments').delete().eq('id', comment.id);
    haptics.tap();
    setComments((prev) => prev.filter((c) => c.id !== comment.id));
    setPost((prev) => prev && { ...prev, comment_count: Math.max(prev.comment_count - 1, 0) });
  };

  const toggleFollow = async () => {
    if (!post || !session?.user) return;
    haptics.tap();
    if (following) {
      await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', post.author_id);
    } else {
      await supabase.from('follows').insert({ follower_id: session.user.id, following_id: post.author_id });
    }
    setFollowing(!following);
  };

  const openShare = () => setShareSheetVisible(true);

  // react-native's own Share.share() turned out to hang indefinitely on a
  // real device in this Expo SDK/New Architecture setup — confirmed via
  // device logs that it's reliably invoked but its promise never resolves
  // or rejects, so the OS sheet never appears and there's no error to
  // catch. expo-clipboard doesn't have that problem, and on web prefer the
  // real native share dialog (navigator.share) when the browser has one.
  const shareExternally = async () => {
    if (!post) return;
    const message = `${post.title} — via Havenly`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: post.title, text: message }); } catch { /* user cancelled — not an error */ }
      return;
    }
    try {
      await Clipboard.setStringAsync(message);
      showToast('Copied to clipboard');
    } catch {
      showToast('Couldn’t copy — try again', 'error');
    }
  };

  const onMessage = async () => {
    if (!post || !session?.user || messaging) return;
    setMessaging(true);
    try {
      const conversationId = await findOrCreateConversation(session.user.id, post.author_id);
      navigation.navigate('Chat', { conversationId, otherUserId: post.author_id });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t start conversation.', 'error');
    } finally {
      setMessaging(false);
    }
  };

  const handleDeletePost = () => setDeletePostConfirmVisible(true);

  const confirmDeletePost = async () => {
    if (!post) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (error) {
      showToast('Couldn’t delete post. Try again.', 'error');
      return;
    }
    haptics.success();
    showToast('Post deleted');
    navigation.goBack();
  };

  const handleBlock = () => setBlockConfirmVisible(true);

  const confirmBlock = async () => {
    if (!post || !session?.user) return;
    try {
      await blockUser(session.user.id, post.author_id);
      haptics.success();
      navigation.goBack();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t block. Try again.', 'error');
    }
  };

  const openOptions = () => {
    if (!post) return;
    setOptionsVisible(true);
  };

  const handleReportSubmit = async (reason: string) => {
    setReportModalVisible(false);
    if (!post || !session?.user) return;
    try {
      await submitReport(session.user.id, 'post', post.id, reason);
      showToast('Thanks — we’ve got your report.');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t submit report.', 'error');
    }
  };

  if (!post) {
    return loaded ? (
      <View style={styles.notFound}>
        <BackButton style={[styles.back, { top: insets.top + 12 }]}>
          <Icon name="arrow-left" size={16} color="#20261F" />
        </BackButton>
        <Text style={styles.notFoundText}>This post isn't available.</Text>
      </View>
    ) : null;
  }

  const isOwnPost = post.author_id === session?.user.id;
  const [heroFrom, heroTo] = gradients[post.id.charCodeAt(0) % gradients.length];

  const renderCommentRow = (comment: Comment) => (
    <Pressable
      key={comment.id}
      style={styles.commentRow}
      onPress={() => navigation.navigate('UserProfile', { userId: comment.author_id })}
      onLongPress={() => comment.author_id === session?.user.id && deleteComment(comment)}
    >
      {comment.author?.avatar_url ? (
        <Image source={{ uri: comment.author.avatar_url }} style={styles.commentAvatar} transition={200} />
      ) : (
        <InitialsAvatar name={comment.author?.display_name} style={styles.commentAvatar} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.commentMeta}>
          <Text style={styles.commentUser}>@{comment.author?.username ?? 'user'}</Text> · {timeAgo(comment.created_at)}
        </Text>
        <Text style={styles.commentBody}>{comment.body}</Text>
      </View>
    </Pressable>
  );

  // Video posts open full-screen, TikTok-style — the clip fills the whole
  // screen with everything else (author, caption, actions) overlaid on top,
  // instead of being a hero image at the top of a scrolling detail page.
  // Comments move into a sheet since there's no scrolling body to hold them.
  if (post.video_url) {
    return (
      <View style={styles.videoContainer}>
        <PostVideoPlayer
          ref={videoPlayerRef}
          uri={post.video_url}
          onDoubleTap={() => { playHeartPop(); setLikedState(true); }}
          onMutedChange={setVideoMuted}
        />
        <Animated.View
          pointerEvents="none"
          style={[styles.heartPop, { opacity: heartPopOpacity, transform: [{ scale: heartPopScale }] }]}
        >
          <Icon name="heart" size={84} color="white" weight="fill" />
        </Animated.View>

        <BackButton style={[styles.videoBack, { top: insets.top + 12 }]}>
          <Icon name="arrow-left" size={18} color="white" />
        </BackButton>
        <Pressable
          style={[styles.videoOverflow, { top: insets.top + 12 }]}
          onPress={openOptions}
          accessibilityLabel="More options"
        >
          <Icon name="more-horizontal" size={20} color="white" />
        </Pressable>

        <View style={[styles.videoBottomRow, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.videoInfo}>
            <View style={styles.videoUserRow}>
              <Pressable
                style={styles.videoAuthorTap}
                disabled={post.is_editorial}
                onPress={() => navigation.navigate('UserProfile', { userId: post.author_id })}
                accessibilityLabel={`View @${post.author?.username ?? 'user'}'s profile`}
              >
                {post.author?.avatar_url ? (
                  <Image source={{ uri: post.author.avatar_url }} style={styles.videoAvatar} transition={200} />
                ) : (
                  <InitialsAvatar name={post.author?.display_name} style={styles.videoAvatar} />
                )}
                <Text style={styles.videoUsername} numberOfLines={1}>
                  {post.is_editorial ? 'Havenly Editorial' : `@${post.author?.username ?? 'user'}`}
                </Text>
              </Pressable>
              {!isOwnPost && (
                <AnimatedPressable
                  style={[styles.videoFollowBtn, following && styles.videoFollowBtnActive]}
                  onPress={toggleFollow}
                  accessibilityLabel={following ? 'Unfollow this user' : 'Follow this user'}
                >
                  <Text style={[styles.videoFollowBtnText, following && styles.videoFollowBtnTextActive]}>
                    {following ? 'Following' : 'Follow'}
                  </Text>
                </AnimatedPressable>
              )}
            </View>
            <Text style={styles.videoTag}>{post.tag}</Text>
            <Text style={styles.videoTitle} numberOfLines={2}>{post.title}</Text>
            {post.body ? <Text style={styles.videoBody} numberOfLines={2}>{post.body}</Text> : null}
          </View>

          <View style={styles.videoRail}>
            <AnimatedPressable
              style={styles.railItem}
              onPress={() => videoPlayerRef.current?.toggleMute()}
              accessibilityLabel={videoMuted ? 'Unmute' : 'Mute'}
            >
              <View style={styles.railIconCircle}>
                <Icon name={videoMuted ? 'volume-off' : 'volume-on'} size={20} color="white" />
              </View>
            </AnimatedPressable>
            <AnimatedPressable style={styles.railItem} onPress={toggleLike} accessibilityLabel={liked ? 'Unlike' : 'Like'}>
              <Animated.View style={[styles.railIconCircle, { transform: [{ scale: likeIconScale }] }]}>
                <Icon name="heart" size={22} color={liked ? colors.coral : 'white'} weight={liked ? 'fill' : undefined} />
              </Animated.View>
              <Text style={styles.railText}>{formatCount(post.like_count)}</Text>
            </AnimatedPressable>
            <AnimatedPressable style={styles.railItem} onPress={() => setCommentsVisible(true)} accessibilityLabel="View comments">
              <View style={styles.railIconCircle}><Icon name="message-circle" size={22} color="white" /></View>
              <Text style={styles.railText}>{formatCount(post.comment_count)}</Text>
            </AnimatedPressable>
            {!isOwnPost && (
              <AnimatedPressable style={styles.railItem} onPress={onMessage} accessibilityLabel="Message this user">
                <View style={styles.railIconCircle}><Icon name="send" size={19} color="white" /></View>
              </AnimatedPressable>
            )}
            <AnimatedPressable style={styles.railItem} onPress={openShare} accessibilityLabel="Share this post">
              <View style={styles.railIconCircle}><Icon name="share" size={19} color="white" /></View>
            </AnimatedPressable>
            <AnimatedPressable style={styles.railItem} onPress={toggleSave} accessibilityLabel={saved ? 'Remove from saved' : 'Save this post'}>
              <View style={styles.railIconCircle}><Icon name="bookmark" size={19} color={saved ? colors.coral : 'white'} weight={saved ? 'fill' : undefined} /></View>
            </AnimatedPressable>
          </View>
        </View>

        <Modal visible={commentsVisible} transparent animationType="slide" onRequestClose={() => setCommentsVisible(false)}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable style={styles.sheetBackdrop} onPress={() => setCommentsVisible(false)} />
            <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
              <View style={styles.sheetHandle} />
              <Text style={[styles.commentsLabel, { paddingHorizontal: spacing.lg }]}>Comments</Text>
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
                {comments.map(renderCommentRow)}
                {comments.length === 0 && <Text style={styles.noComments}>No comments yet — be the first.</Text>}
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
                <Pressable style={styles.commentSendBtn} onPress={addComment} accessibilityLabel="Post comment">
                  <Icon name="send" size={15} color={colors.sand} />
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <ReportModal visible={reportModalVisible} onClose={() => setReportModalVisible(false)} onSubmit={handleReportSubmit} />
        <ActionSheet
          visible={optionsVisible}
          onClose={() => setOptionsVisible(false)}
          actions={
            isOwnPost
              ? [{ label: 'Delete post', destructive: true, onPress: handleDeletePost }]
              : [
                  { label: 'Report post', onPress: () => setReportModalVisible(true) },
                  { label: `Block @${post.author?.username ?? 'user'}`, destructive: true, onPress: handleBlock },
                ]
          }
        />
        <ActionSheet
          visible={blockConfirmVisible}
          onClose={() => setBlockConfirmVisible(false)}
          title={`Block @${post.author?.username ?? 'this user'}?`}
          message="They won't be able to message you or see each other's posts anymore."
          actions={[{ label: 'Block', destructive: true, onPress: confirmBlock }]}
        />
        <ActionSheet
          visible={deletePostConfirmVisible}
          onClose={() => setDeletePostConfirmVisible(false)}
          title="Delete this post?"
          message="This can't be undone — it'll remove the post along with its likes and comments."
          actions={[{ label: 'Delete', destructive: true, onPress: confirmDeletePost }]}
        />
        <ActionSheet
          visible={!!deleteCommentTarget}
          onClose={() => setDeleteCommentTarget(null)}
          title="Delete comment?"
          actions={[{ label: 'Delete', destructive: true, onPress: confirmDeleteComment }]}
        />
        <ActionSheet
          visible={shareSheetVisible}
          onClose={() => setShareSheetVisible(false)}
          actions={[
            { label: 'Send to a follower', onPress: () => navigation.navigate('SharePost', { postId: post.id }) },
            { label: 'Share externally', onPress: shareExternally },
          ]}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={styles.container}>
    <ReanimatedAnimated.ScrollView onScroll={onScroll} scrollEventThrottle={16}>
      <View style={styles.hero}>
        <ReanimatedAnimated.View style={[StyleSheet.absoluteFill, heroAnimatedStyle]}>
          <LinearGradient colors={[heroFrom, heroTo]} style={StyleSheet.absoluteFill} />
          {post.video_url ? (
            <PostVideoPlayer uri={post.video_url} onDoubleTap={() => { playHeartPop(); setLikedState(true); }} />
          ) : post.image_url ? (
            <Pressable style={StyleSheet.absoluteFill} onPress={handleImageTap}>
              <Image source={{ uri: post.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
            </Pressable>
          ) : null}
        </ReanimatedAnimated.View>
        <ReanimatedAnimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, heroDimStyle]} />
        <Animated.View
          pointerEvents="none"
          style={[styles.heartPop, { opacity: heartPopOpacity, transform: [{ scale: heartPopScale }] }]}
        >
          <Icon name="heart" size={84} color="white" weight="fill" />
        </Animated.View>
        <BackButton style={[styles.back, { top: insets.top + 12 }]}>
          <Icon name="arrow-left" size={16} color="#20261F" />
        </BackButton>
        <Pressable
          style={[styles.overflow, { top: insets.top + 12 }]}
          onPress={openOptions}
          accessibilityLabel="More options"
        >
          <Icon name="more-horizontal" size={17} color="#20261F" />
        </Pressable>
      </View>
      <View style={styles.body}>
        <Text style={styles.tag}>{post.tag}</Text>
        <Text style={styles.title}>{post.title}</Text>

        <View style={styles.userRow}>
          <Pressable
            style={styles.authorTap}
            disabled={post.is_editorial}
            onPress={() => navigation.navigate('UserProfile', { userId: post.author_id })}
            accessibilityLabel={`View @${post.author?.username ?? 'user'}'s profile`}
          >
            {post.author?.avatar_url ? (
              <Image source={{ uri: post.author.avatar_url }} style={styles.avatar} transition={200} />
            ) : (
              <InitialsAvatar name={post.author?.display_name} style={styles.avatar} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.username}>{post.is_editorial ? 'Havenly Editorial' : `@${post.author?.username ?? 'user'}`}</Text>
              <Text style={styles.meta}>{timeAgo(post.created_at)}</Text>
            </View>
          </Pressable>
          {!isOwnPost && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <AnimatedPressable style={styles.messageBtn} onPress={onMessage} accessibilityLabel="Message this user">
                <Icon name="message-circle" size={14} color={colors.ink} />
              </AnimatedPressable>
              <AnimatedPressable
                style={[styles.followBtn, following && styles.followBtnActive]}
                onPress={toggleFollow}
                accessibilityLabel={following ? 'Unfollow this user' : 'Follow this user'}
              >
                <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
                  {following ? 'Following' : 'Follow'}
                </Text>
              </AnimatedPressable>
            </View>
          )}
        </View>

        {post.body ? <Text style={styles.text}>{post.body}</Text> : null}

        <View style={styles.actionBar}>
          <AnimatedPressable style={styles.actionItem} onPress={toggleLike} accessibilityLabel={liked ? 'Unlike' : 'Like'}>
            <Animated.View style={{ transform: [{ scale: likeIconScale }] }}>
              <Icon name="heart" size={15} color={liked ? colors.coral : colors.inkSoft} weight={liked ? 'fill' : undefined} />
            </Animated.View>
            <Text style={[styles.actionText, liked && styles.actionTextActive]}>{formatCount(post.like_count)}</Text>
          </AnimatedPressable>
          <View style={styles.actionItem}>
            <Icon name="message-circle" size={15} color={colors.inkSoft} />
            <Text style={styles.actionText}>{post.comment_count}</Text>
          </View>
          <AnimatedPressable style={styles.actionItem} onPress={openShare} accessibilityLabel="Share this post">
            <Icon name="share" size={15} color={colors.inkSoft} />
            <Text style={styles.actionText}>Share</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.actionItem} onPress={toggleSave} accessibilityLabel={saved ? 'Remove from saved' : 'Save this post'}>
            <Icon name="bookmark" size={15} color={saved ? colors.coral : colors.inkSoft} weight={saved ? 'fill' : undefined} />
            <Text style={[styles.actionText, saved && styles.actionTextActive]}>{saved ? 'Saved' : 'Save'}</Text>
          </AnimatedPressable>
        </View>

        <View style={styles.commentsSection}>
          <Text style={styles.commentsLabel}>Comments</Text>
          {comments.map(renderCommentRow)}
          {comments.length === 0 && <Text style={styles.noComments}>No comments yet — be the first.</Text>}
        </View>
      </View>
      <ReportModal visible={reportModalVisible} onClose={() => setReportModalVisible(false)} onSubmit={handleReportSubmit} />
      <ActionSheet
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        actions={
          isOwnPost
            ? [{ label: 'Delete post', destructive: true, onPress: handleDeletePost }]
            : [
                { label: 'Report post', onPress: () => setReportModalVisible(true) },
                { label: `Block @${post.author?.username ?? 'user'}`, destructive: true, onPress: handleBlock },
              ]
        }
      />
      <ActionSheet
        visible={blockConfirmVisible}
        onClose={() => setBlockConfirmVisible(false)}
        title={`Block @${post.author?.username ?? 'this user'}?`}
        message="They won't be able to message you or see each other's posts anymore."
        actions={[{ label: 'Block', destructive: true, onPress: confirmBlock }]}
      />
      <ActionSheet
        visible={deletePostConfirmVisible}
        onClose={() => setDeletePostConfirmVisible(false)}
        title="Delete this post?"
        message="This can't be undone — it'll remove the post along with its likes and comments."
        actions={[{ label: 'Delete', destructive: true, onPress: confirmDeletePost }]}
      />
      <ActionSheet
        visible={!!deleteCommentTarget}
        onClose={() => setDeleteCommentTarget(null)}
        title="Delete comment?"
        actions={[{ label: 'Delete', destructive: true, onPress: confirmDeleteComment }]}
      />
      <ActionSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        actions={[
          { label: 'Send to a follower', onPress: () => navigation.navigate('SharePost', { postId: post.id }) },
          { label: 'Share externally', onPress: shareExternally },
        ]}
      />
    </ReanimatedAnimated.ScrollView>
    <View style={styles.commentInputRow}>
      <TextInput
        style={styles.commentInput}
        placeholder="Add a comment…"
        placeholderTextColor={colors.inkSoft}
        value={commentInput}
        onChangeText={setCommentInput}
        onSubmitEditing={addComment}
      />
      <Pressable style={styles.commentSendBtn} onPress={addComment} accessibilityLabel="Post comment">
        <Icon name="send" size={15} color={colors.sand} />
      </Pressable>
    </View>
    </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  hero: { width: '100%', height: 340, overflow: 'hidden' },
  heartPop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 2 },
  },
  back: {
    position: 'absolute', top: 16, left: 16, width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(251,245,234,0.92)', alignItems: 'center', justifyContent: 'center',
  },
  overflow: {
    position: 'absolute', top: 16, right: 16, width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(251,245,234,0.92)', alignItems: 'center', justifyContent: 'center',
  },
  notFound: { flex: 1, backgroundColor: colors.sand, paddingTop: 60, paddingHorizontal: spacing.lg },
  notFoundText: { color: colors.inkSoft, textAlign: 'center', marginTop: 100 },
  body: { padding: spacing.lg },
  tag: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 10.5, color: colors.teal, textTransform: 'uppercase' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 22, color: colors.ink, marginTop: 8, lineHeight: 28 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 14 },
  authorTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  // Fixed black background regardless of theme — a full-screen video player
  // reads the same way (and the overlaid white text/icons stay legible)
  // whether the app is in light or dark mode, same reasoning as the
  // Login/SignUp hero always being a fixed dark panel.
  videoContainer: { flex: 1, backgroundColor: '#000' },
  videoBack: {
    position: 'absolute', left: 16, width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  videoOverflow: {
    position: 'absolute', right: 16, width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  videoBottomRow: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: spacing.lg, paddingTop: 40, gap: spacing.md,
  },
  videoInfo: { flex: 1, gap: 2 },
  videoUserRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  videoAuthorTap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  videoAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: 'white' },
  videoUsername: { fontSize: 13.5, fontWeight: '700', color: 'white', flexShrink: 1 },
  videoFollowBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1.5, borderColor: 'white' },
  videoFollowBtnActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  videoFollowBtnText: { fontSize: 11, fontWeight: '700', color: 'white' },
  videoFollowBtnTextActive: { color: 'white' },
  videoTag: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 10, color: colors.gold, textTransform: 'uppercase', marginBottom: 2 },
  videoTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 17, color: 'white', lineHeight: 21 },
  videoBody: { fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 4, lineHeight: 18 },
  videoRail: { alignItems: 'center', gap: 18, paddingBottom: 4 },
  railItem: { alignItems: 'center', gap: 4 },
  railIconCircle: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  railText: { fontSize: 11, fontWeight: '700', color: 'white' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.sand, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    maxHeight: '65%', paddingTop: 10,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 10 },
  });
}
