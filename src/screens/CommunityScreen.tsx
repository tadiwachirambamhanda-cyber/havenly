import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, ScrollView, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import Icon, { type IconName } from '@/components/Icon';
import AnimatedPressable from '@/components/AnimatedPressable';
import { StateBlock } from '@/components/housing/parts';
import PostCard from '@/components/community/PostCard';
import EventCard, { useGoing } from '@/components/community/EventCard';
import PerkCard, { usePerkCodes } from '@/components/community/PerkCard';
import FindCommunities from '@/components/community/FindCommunities';
import { usePostActions } from '@/components/community/usePostActions';
import { useMembership } from '@/components/community/useMembership';
import { useSafetyMenu } from '@/components/community/SafetyMenu';
import { BOLD, CardSkeletons, Content, GUTTER, Pill, SectionLabel, TITLE_FONT } from '@/components/community/ui';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { useUnreadMessages } from '@/lib/useUnreadMessages';
import { communityInitials, orderCommunities } from '@/lib/community';
import {
  fetchCommunities, fetchNewCounts, fetchPerks, fetchPosts, fetchUpcomingEvents, type EventRow, type FeedPost, type PerkRow,
} from '@/lib/communityApi';
import type { Community } from '@/types';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Loaded { owner: string | undefined; communities: Community[]; newCounts: Record<string, number>; failed: boolean }
type Item = { kind: 'post'; post: FeedPost } | { kind: 'event'; event: EventRow } | { kind: 'perk'; perk: PerkRow };

// The Community tab (F18): my communities (my university first), shortcuts, and the latest posts, events and
// a perk from the communities I joined. Keyed by the account so nothing from another account ever shows.
export default function CommunityScreen() {
  const { session } = useAuth();
  return <CommunityHome key={session?.user.id ?? 'signed-out'} />;
}

function CommunityHome() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const myId = session?.user.id;
  const myUniversity = profile?.university ?? null;
  const { colors } = useTheme();
  const { showToast } = useToast();
  const s = useMemo(() => styles(colors), [colors]);
  const hasUnread = useUnreadMessages();

  const [data, setData] = useState<Loaded | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [perks, setPerks] = useState<PerkRow[]>([]);
  const [view, setView] = useState<'latest' | 'events'>('latest');
  const [findOpen, setFindOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const membership = useMembership();
  const { joinedIds, load: loadMembership } = membership;

  const load = useCallback(async () => {
    try {
      const [communities, ids] = await Promise.all([fetchCommunities(), loadMembership()]);
      const [feed, upcoming, perkRows, newCounts] = await Promise.all([
        fetchPosts(myId, [...ids]),
        fetchUpcomingEvents(null, 30).then((rows) => rows.filter((e) => !e.community_id || ids.has(e.community_id))),
        fetchPerks().catch(() => [] as PerkRow[]),
        fetchNewCounts(communities.filter((c) => ids.has(c.id) || (!!myUniversity && c.related_university === myUniversity)).map((c) => c.id)),
      ]);
      setPosts(feed);
      setEvents(upcoming);
      setPerks(perkRows);
      setData({ owner: myId, communities, newCounts, failed: false });
    } catch {
      setData({ owner: myId, communities: [], newCounts: {}, failed: true });
    }
  }, [myId, myUniversity, loadMembership]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const actions = usePostActions(setPosts);
  const going = useGoing(setEvents);
  const perkCodes = usePerkCodes();
  const eventMenu = useSafetyMenu();

  const current = data && data.owner === myId ? data : null;
  const order = useMemo(
    () => (current && joinedIds ? orderCommunities(current.communities, myUniversity, joinedIds) : null),
    [current, joinedIds, myUniversity],
  );

  const join = async (c: Community) => { await membership.join(c); load(); };
  const openCommunity = (c: Community) => { setFindOpen(false); navigation.navigate('CommunityDetail', { communityId: c.id }); };
  const writePost = () => {
    if (!joinedIds?.size) { showToast('Join a community first, then you can post in it.'); setFindOpen(true); return; }
    const uniJoined = order?.uni && joinedIds.has(order.uni.id) ? order.uni.id : undefined;
    navigation.navigate('CreatePost', uniJoined ? { communityId: uniJoined } : undefined);
  };

  const shortcut = (label: string, icon: IconName, bg: string, fg: string, onPress: () => void, border: string, selected?: boolean) => (
    <AnimatedPressable
      key={label} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={[s.shortcut, { backgroundColor: bg, borderColor: border }]}
    >
      <Icon name={icon} size={20} color={fg} />
      <Text style={[s.shortcutText, { color: fg }]}>{label}</Text>
    </AnimatedPressable>
  );

  const communityCard = (c: Community) => {
    const isUni = c.id === order?.uni?.id;
    const joined = !!joinedIds?.has(c.id);
    const n = current?.newCounts[c.id] ?? 0;
    const line = !joined ? 'Your university · tap to join' : `${isUni ? 'Your university' : 'Joined'} · ${n ? `${n} new` : 'nothing new'}`;
    return (
      <AnimatedPressable
        key={c.id} onPress={() => openCommunity(c)} accessibilityRole="button" accessibilityLabel={`${c.name}. ${line}`}
        style={[s.commCard, isUni ? { backgroundColor: colors.coralFill, borderColor: colors.coralFill } : null]}
      >
        <View style={[s.commBadge, { backgroundColor: isUni ? 'rgba(255,255,255,0.22)' : colors.coralSoft }]}>
          <Text style={[s.commBadgeText, { color: isUni ? '#FFFFFF' : colors.coral }]}>{communityInitials(c.name)}</Text>
        </View>
        <Text style={[s.commName, { color: isUni ? '#FFFFFF' : colors.ink }]} numberOfLines={2}>{c.name}</Text>
        <Text style={[s.commMeta, { color: isUni ? '#FFFFFF' : colors.inkSoft }]} numberOfLines={2}>{line}</Text>
      </AnimatedPressable>
    );
  };

  const header = (
    <Content>
      <View style={[s.top, { paddingTop: insets.top + 12 }]}>
        <Text style={s.title} accessibilityRole="header">Community</Text>
        <AnimatedPressable
          // Inbox becomes a stack route (same name) on the Chief Architect's three-tab branch; until it merges
          // it is a tab route, which the root stack's types do not list, hence the cast.
          onPress={() => navigation.navigate('Inbox' as never)}
          style={s.roundBtn} accessibilityRole="button" accessibilityLabel="Messages"
          accessibilityHint={hasUnread ? 'You have unread messages' : undefined}
        >
          <Icon name="message-circle" size={20} color={colors.ink} />
          {hasUnread ? <View style={s.dot} /> : null}
        </AnimatedPressable>
        <Pill label="Post" icon="plus" onPress={writePost} accessibilityLabel="Write a post" height={44} />
      </View>

      <SectionLabel style={{ marginTop: 6 }}>My communities</SectionLabel>
      {!order ? (current?.failed ? null : <CardSkeletons count={1} height={128} />) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.commRow}>
          {order.mine.map(communityCard)}
          <AnimatedPressable onPress={() => setFindOpen(true)} style={[s.commCard, s.findCard]} accessibilityRole="button" accessibilityLabel="Find more communities">
            <Icon name="search" size={22} color={colors.coral} />
            <Text style={[s.commName, { color: colors.coral }]}>Find more</Text>
          </AnimatedPressable>
        </ScrollView>
      )}

      <View style={s.shortcuts}>
        {shortcut('Housemates', 'users', colors.mintBg, colors.mintText, () => navigation.navigate('HousemateBoard'), colors.mintBg)}
        {shortcut('Events', 'calendar', view === 'events' ? colors.ink : colors.white, view === 'events' ? colors.sand : colors.ink,
          () => setView((v) => (v === 'events' ? 'latest' : 'events')), view === 'events' ? colors.ink : colors.line, view === 'events')}
        {shortcut('Perks', 'gift', colors.dealBg, colors.dealText, () => navigation.navigate('Perks'), colors.dealBg)}
      </View>

      {profile?.is_admin ? (
        <View style={s.team}>
          <Text style={s.teamLabel}>Team</Text>
          <View style={s.teamRow}>
            <Pill label="Review reports" icon="shield-check" onPress={() => navigation.navigate('ReviewQueue')} />
            <Pill label="Manage events" icon="calendar" onPress={() => navigation.navigate('ManageEvents')} />
            <Pill label="Manage perks" icon="gift" onPress={() => navigation.navigate('ManagePerks')} />
          </View>
        </View>
      ) : null}

      <SectionLabel>{view === 'events' ? 'Upcoming events' : 'Latest from your communities'}</SectionLabel>
    </Content>
  );

  // Latest: posts, with the next event after the first post and a perk after the third (handoff design).
  const items: Item[] = [];
  if (view === 'events') {
    events.forEach((e) => items.push({ kind: 'event', event: e }));
  } else {
    posts.forEach((p, i) => {
      items.push({ kind: 'post', post: p });
      if (i === 0 && events[0]) items.push({ kind: 'event', event: events[0] });
      if (i === 2 && perks[0]) items.push({ kind: 'perk', perk: perks[0] });
    });
    if (posts.length === 0 && events[0]) items.push({ kind: 'event', event: events[0] });
    if (posts.length < 3 && perks[0]) items.push({ kind: 'perk', perk: perks[0] });
  }

  let empty: React.ReactNode = null;
  if (!current) empty = <CardSkeletons count={3} />;
  else if (current.failed) {
    empty = <StateBlock icon="alert-circle" kind="error" title="We could not load Community" body="Check your connection and try again."
      primary={{ label: 'Try again', onPress: () => { setData(null); load(); } }} />;
  } else if (view === 'events') {
    empty = <StateBlock icon="calendar" title="No events coming up" body="The team adds events for students. New ones show up here." />;
  } else if (!joinedIds?.size) {
    empty = <StateBlock icon="users" title="Join your first community" body="Communities are where students ask about areas, find housemates and share tips."
      primary={{ label: order?.uni ? 'Open your university' : 'Find your university', onPress: () => (order?.uni ? openCommunity(order.uni) : setFindOpen(true)) }} />;
  }
  const noPostsYet = !!current && !current.failed && view === 'latest' && !!joinedIds?.size && posts.length === 0;

  return (
    <View style={s.container}>
      <FlatList
        data={current && !current.failed && !empty ? items : []}
        keyExtractor={(it) => (it.kind === 'post' ? `p-${it.post.id}` : it.kind === 'event' ? `e-${it.event.id}` : `k-${it.perk.id}`)}
        ListHeaderComponent={header}
        ListEmptyComponent={empty ? <Content>{empty}</Content> : undefined}
        ListFooterComponent={noPostsYet ? (
          <Content><StateBlock icon="message-circle" title="No posts yet" body="Ask the first question in one of your communities." primary={{ label: 'Write a post', onPress: writePost }} /></Content>
        ) : undefined}
        renderItem={({ item }) => (
          <Content>
            {item.kind === 'post' ? (
              <PostCard post={item.post} myId={myId} onLike={actions.onLike} onMenu={actions.onMenu} showCommunity />
            ) : item.kind === 'event' ? (
              <EventCard
                event={item.event} going={going.going.has(item.event.id)} onToggle={() => going.toggle(item.event)}
                onMenu={() => eventMenu.open({ type: 'event', id: item.event.id })}
              />
            ) : (
              <PerkCard perk={item.perk} code={perkCodes.codes[item.perk.id]} loading={perkCodes.busy === item.perk.id} onGetCode={() => perkCodes.getCode(item.perk.id)} />
            )}
          </Content>
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
      />
      <FindCommunities
        visible={findOpen} onClose={() => setFindOpen(false)} communities={order?.more ?? []} joinedIds={joinedIds ?? new Set()}
        joiningId={membership.joiningId} onJoin={join} onOpen={openCommunity}
      />
      {actions.menus}
      {eventMenu.element}
    </View>
  );
}

function styles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: GUTTER },
    title: { flex: 1, fontFamily: TITLE_FONT, fontSize: 31, letterSpacing: -0.8, color: colors.ink },
    roundBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
    dot: { position: 'absolute', top: 8, right: 9, width: 11, height: 11, borderRadius: 6, backgroundColor: colors.coralFill, borderWidth: 2, borderColor: colors.white },
    commRow: { gap: 10, paddingHorizontal: GUTTER },
    commCard: { width: 168, minHeight: 132, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, padding: 14, gap: 6 },
    findCard: { width: 120, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderColor: colors.fieldLine, backgroundColor: 'transparent' },
    commBadge: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    commBadgeText: { fontFamily: BOLD, fontSize: 14 },
    commName: { fontFamily: BOLD, fontSize: 15, lineHeight: 19 },
    commMeta: { fontSize: 12.5 },
    shortcuts: { flexDirection: 'row', gap: 10, paddingHorizontal: GUTTER, marginTop: 16 },
    shortcut: { flex: 1, minHeight: 72, borderRadius: 22, borderWidth: 1, padding: 12, gap: 6, justifyContent: 'center' },
    shortcutText: { fontFamily: BOLD, fontSize: 14 },
    team: { marginHorizontal: GUTTER, marginTop: 14, padding: 12, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, gap: 8 },
    teamLabel: { fontFamily: BOLD, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.inkSoft },
    teamRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });
}
