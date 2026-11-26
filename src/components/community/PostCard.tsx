import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '@/components/Text';
import Icon from '@/components/Icon';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useTheme } from '@/lib/ThemeContext';
import { usePhotoLinks } from '@/lib/communityPhotos';
import { timeAgo } from '@/lib/community';
import type { FeedComment, FeedPost } from '@/lib/communityApi';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { Avatar, BOLD, GUTTER, Pill } from './ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// The photos of a post, from the private store through short-lived links.
export function PostPhotos({ paths, large }: { paths: string[] | null | undefined; large?: boolean }) {
  const { colors } = useTheme();
  const links = usePhotoLinks(paths);
  const list = paths ?? [];
  if (!list.length) return null;
  const size = list.length === 1 ? (large ? 260 : 200) : large ? 170 : 130;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
      {list.map((p, i) => {
        const url = links && links !== 'failed' ? links[p] : undefined;
        return (
          <View
            key={p}
            style={{ flexBasis: list.length === 1 ? '100%' : '47%', flexGrow: 1, height: size, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.photo, alignItems: 'center', justifyContent: 'center' }}
            accessibilityLabel={`Photo ${i + 1} of ${list.length}`}
          >
            {url ? (
              <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : links === undefined ? null : (
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Icon name="image" size={18} color={colors.inkSoft} />
                <Text style={{ fontSize: 12, color: colors.inkSoft }}>Photo unavailable</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// The area or listing a post is tagged with. Opens the listing, or Housing for an area.
export function TagChip({ post }: { post: Pick<FeedPost, 'area' | 'residence_id' | 'residence'> }) {
  const navigation = useNavigation<Nav>();
  const label = post.residence?.name ?? post.area ?? null;
  if (!label) return null;
  const open = () => {
    if (post.residence_id) navigation.navigate('ResidenceDetail', { residenceId: post.residence_id });
    // An area opens the Housing tab with that area in its search.
    else if (post.area) navigation.navigate('MainTabs', { screen: 'Housing', params: { area: post.area } });
  };
  return (
    <Pill
      label={label} icon="map-pin" tone="mint" onPress={open} height={36}
      accessibilityLabel={post.residence_id ? `Open the listing ${label}` : `Find places in ${label}`}
      style={{ alignSelf: 'flex-start', marginTop: 10 }}
    />
  );
}

interface Props {
  post: FeedPost;
  myId: string | undefined;
  onLike: (post: FeedPost) => void;
  onMenu: (post: FeedPost) => void;
  comments?: FeedComment[];
  showCommunity?: boolean;
  full?: boolean;
}

export default function PostCard({ post, myId, onLike, onMenu, comments, showCommunity, full }: Props) {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const s = useMemo(() => styles(colors), [colors]);
  const name = post.author?.display_name ?? 'A student';
  const uni = post.author?.university;
  const open = full ? undefined : () => navigation.navigate('PostDetail', { postId: post.id });
  const meta = [showCommunity ? post.community?.name : uni, timeAgo(post.created_at)].filter(Boolean).join(' · ');

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Avatar name={name} url={post.author?.avatar_url} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.name} numberOfLines={1}>{name}{post.author_id === myId ? ' (you)' : ''}</Text>
          <Text style={s.meta} numberOfLines={1}>{meta}</Text>
          {showCommunity && uni ? <Text style={s.meta} numberOfLines={1}>{uni}</Text> : null}
        </View>
        <AnimatedPressable
          onPress={() => onMenu(post)} style={s.more} hitSlop={6}
          accessibilityRole="button" accessibilityLabel={`More options for ${name}’s post`}
        >
          <Icon name="more-horizontal" size={20} color={colors.inkSoft} />
        </AnimatedPressable>
      </View>

      {post.hidden_at ? (
        <View style={s.hidden}>
          <Icon name="alert-circle" size={15} color={colors.errorText} />
          <Text style={s.hiddenText}>Hidden after reports. Only you and the team can see it.</Text>
        </View>
      ) : null}

      <Pressable onPress={open} disabled={!open} accessibilityRole={open ? 'button' : undefined} accessibilityLabel={open ? `Open ${name}’s post` : undefined}>
        <Text style={s.body} numberOfLines={full ? undefined : 8}>{post.body ?? post.title ?? ''}</Text>
      </Pressable>
      <PostPhotos paths={post.image_paths} large={full} />
      <TagChip post={post} />

      <View style={s.actions}>
        <Pill
          label={String(post.like_count ?? 0)} icon="heart" tone={post.liked ? 'mint' : 'plain'} selected={post.liked}
          onPress={() => onLike(post)}
          accessibilityLabel={post.liked ? `Liked, ${post.like_count} likes. Tap to unlike` : `Like, ${post.like_count} likes`}
        />
        <Pill
          label={post.comment_count === 1 ? '1 comment' : `${post.comment_count ?? 0} comments`} icon="message-circle"
          onPress={open}
        />
      </View>

      {comments && comments.length ? (
        <View style={s.comments}>
          {comments.map((c) => (
            <View key={c.id} style={s.comment}>
              <Avatar name={c.author?.display_name} url={c.author?.avatar_url} size={26} />
              <Text style={s.commentText} numberOfLines={3}>
                <Text style={s.commentName}>{c.author?.display_name ?? 'A student'}</Text>
                {c.author?.university ? <Text style={s.meta}> · {c.author.university}</Text> : null}
                {'  '}{c.body}
              </Text>
            </View>
          ))}
          {post.comment_count > comments.length && open ? (
            <Pressable onPress={open} accessibilityRole="button" style={{ minHeight: 32, justifyContent: 'center' }}>
              <Text style={s.link}>See all {post.comment_count} comments</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function styles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 16, marginHorizontal: GUTTER, marginBottom: 12 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    name: { fontFamily: BOLD, fontSize: 15, color: colors.ink },
    meta: { fontSize: 13, color: colors.inkSoft },
    more: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    body: { fontSize: 16, lineHeight: 23, color: colors.ink, marginTop: 10 },
    hidden: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.errorBg, borderRadius: 10, padding: 8, marginTop: 10 },
    hiddenText: { flex: 1, fontSize: 13, color: colors.errorText },
    actions: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
    comments: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 12, paddingTop: 10, gap: 8 },
    comment: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    commentText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink },
    commentName: { fontFamily: BOLD, fontSize: 14, color: colors.ink },
    link: { fontFamily: BOLD, fontSize: 14, color: colors.coral },
  });
}
