import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '@/components/Text';
import Icon from '@/components/Icon';
import AnimatedPressable from '@/components/AnimatedPressable';
import { StateBlock } from '@/components/housing/parts';
import PostCard from '@/components/community/PostCard';
import { usePostActions } from '@/components/community/usePostActions';
import { useSafetyMenu } from '@/components/community/SafetyMenu';
import { Avatar, BOLD, CardSkeletons, Content, GUTTER, ScreenTop } from '@/components/community/ui';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { COMMENT_MAX, commentProblem, friendlyError, timeAgo } from '@/lib/community';
import { addComment, deleteComment, fetchComments, fetchPost, type FeedComment, type FeedPost } from '@/lib/communityApi';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'PostDetail'>;

// One post with all its comments (F19). Lane A opens this from a listing's "Students talking about this area".
export default function PostDetailScreen() {
  const { session } = useAuth();
  const { postId } = useRoute<Route>().params;
  return <PostDetail key={`${session?.user.id ?? 'out'}-${postId}`} postId={postId} />;
}

function PostDetail({ postId }: { postId: string }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const myId = session?.user.id;
  const { colors } = useTheme();
  const { showToast } = useToast();
  const s = useMemo(() => styles(colors), [colors]);

  // undefined: loading; null: gone (deleted, hidden or blocked); 'failed': could not load.
  const [post, setPost] = useState<FeedPost | null | undefined | 'failed'>(undefined);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await fetchPost(myId, postId);
      setPost(p);
      if (p) setComments((await fetchComments([p.id]))[p.id] ?? []);
    } catch {
      setPost('failed');
    }
  }, [myId, postId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setList = useCallback((u: (prev: FeedPost[]) => FeedPost[]) => {
    setPost((prev) => {
      if (!prev || prev === 'failed') return prev;
      const [next] = u([prev]);
      return next ?? null;
    });
  }, []);
  const actions = usePostActions(setList, { onDeleted: () => navigation.goBack(), onBlocked: () => navigation.goBack() });
  const commentMenu = useSafetyMenu({
    onBlocked: (userId) => setComments((prev) => prev.filter((c) => c.author_id !== userId)),
  });

  const send = async () => {
    if (!myId || !post || post === 'failed') return;
    const problem = commentProblem(draft);
    if (problem) { showToast(problem, 'error'); return; }
    setSending(true);
    haptics.confirm();
    try {
      const c = await addComment(myId, post.id, draft);
      setComments((prev) => [...prev, c]);
      setPost((prev) => (prev && prev !== 'failed' ? { ...prev, comment_count: (prev.comment_count ?? 0) + 1 } : prev));
      setDraft('');
    } catch (e) {
      showToast(friendlyError(e, 'Your comment did not send. Try again.'), 'error');
    } finally {
      setSending(false);
    }
  };

  const openCommentMenu = (c: FeedComment) => commentMenu.open({
    type: 'comment', id: c.id, authorId: c.author_id, authorName: c.author?.display_name ?? null,
    onDelete: c.author_id === myId ? async () => {
      await deleteComment(c.id);
      setComments((prev) => prev.filter((x) => x.id !== c.id));
      setPost((prev) => (prev && prev !== 'failed' ? { ...prev, comment_count: Math.max(0, (prev.comment_count ?? 1) - 1) } : prev));
    } : undefined,
  });

  const top = <View style={{ paddingTop: insets.top + 10 }}><ScreenTop title="Post" /></View>;

  if (post === undefined) return <View style={s.container}><Content>{top}<CardSkeletons count={2} /></Content></View>;
  if (post === 'failed' || post === null) {
    return (
      <View style={s.container}>
        <Content>
          {top}
          {post === 'failed' ? (
            <StateBlock icon="alert-circle" kind="error" title="We could not load this post" body="Check your connection and try again."
              primary={{ label: 'Try again', onPress: () => { setPost(undefined); load(); } }} />
          ) : (
            <StateBlock icon="message-circle" title="This post is no longer available" body="It may have been deleted or hidden after reports." />
          )}
        </Content>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          <Content>
            {top}
            <PostCard post={post} myId={myId} onLike={actions.onLike} onMenu={actions.onMenu} full showCommunity />
            <Text style={s.label} accessibilityRole="header">{comments.length === 1 ? '1 comment' : `${comments.length} comments`}</Text>
          </Content>
        }
        ListEmptyComponent={<Content><Text style={s.empty}>No comments yet. Be the first to answer.</Text></Content>}
        renderItem={({ item }) => (
          <Content>
            <View style={s.comment}>
              <Avatar name={item.author?.display_name} url={item.author?.avatar_url} size={34} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name} numberOfLines={1}>{item.author?.display_name ?? 'A student'}{item.author_id === myId ? ' (you)' : ''}</Text>
                <Text style={s.meta} numberOfLines={1}>{[item.author?.university, timeAgo(item.created_at)].filter(Boolean).join(' · ')}</Text>
                {item.hidden_at ? <Text style={s.hidden}>Hidden after reports. Only you and the team can see it.</Text> : null}
                <Text style={s.body}>{item.body}</Text>
              </View>
              <AnimatedPressable onPress={() => openCommentMenu(item)} style={s.more} accessibilityRole="button" accessibilityLabel={`More options for ${item.author?.display_name ?? 'this'} comment`}>
                <Icon name="more-horizontal" size={18} color={colors.inkSoft} />
              </AnimatedPressable>
            </View>
          </Content>
        )}
        contentContainerStyle={{ paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      />
      <View style={[s.composer, { paddingBottom: insets.bottom + 10 }]}>
        <Content style={s.composerRow}>
          <TextInput
            value={draft} onChangeText={setDraft} placeholder="Write a comment" placeholderTextColor={colors.inkSoft}
            multiline maxLength={COMMENT_MAX} style={s.input} accessibilityLabel="Write a comment" editable={!sending}
          />
          <AnimatedPressable
            onPress={send} disabled={!draft.trim() || sending} accessibilityRole="button" accessibilityLabel="Send comment"
            style={[s.send, { backgroundColor: draft.trim() ? colors.coralFill : colors.inkSoft }]}
          >
            {sending ? <ActivityIndicator color="#FFFFFF" /> : <Icon name="send" size={18} color="#FFFFFF" />}
          </AnimatedPressable>
        </Content>
      </View>
      {actions.menus}
      {commentMenu.element}
    </KeyboardAvoidingView>
  );
}

function styles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    label: { fontFamily: BOLD, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.inkSoft, paddingHorizontal: GUTTER, marginTop: 8, marginBottom: 8 },
    empty: { fontSize: 14, color: colors.inkSoft, paddingHorizontal: GUTTER },
    comment: { flexDirection: 'row', gap: 10, paddingHorizontal: GUTTER, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
    name: { fontFamily: BOLD, fontSize: 14, color: colors.ink },
    meta: { fontSize: 12.5, color: colors.inkSoft },
    hidden: { fontSize: 12.5, color: colors.errorText, marginTop: 4 },
    body: { fontSize: 15, lineHeight: 21, color: colors.ink, marginTop: 4 },
    more: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    composer: { borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white, paddingTop: 10 },
    composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: GUTTER },
    input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.sand, paddingHorizontal: 16, paddingVertical: 11, fontSize: 16, color: colors.ink },
    send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  });
}
