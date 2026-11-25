import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ScrollView } from 'react-native';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import Icon from '@/components/Icon';
import BackButton from '@/components/BackButton';
import AnimatedPressable from '@/components/AnimatedPressable';
import ActionSheet from '@/components/ActionSheet';
import { OutlineButton, StateBlock } from '@/components/housing/parts';
import PostCard from '@/components/community/PostCard';
import EventCard, { useGoing } from '@/components/community/EventCard';
import PerkCard, { usePerkCodes } from '@/components/community/PerkCard';
import HousemateCardView from '@/components/community/HousemateCardView';
import { usePostActions } from '@/components/community/usePostActions';
import { useHousemateActions } from '@/components/community/useHousemateActions';
import { useMembership } from '@/components/community/useMembership';
import { useSafetyMenu } from '@/components/community/SafetyMenu';
import { BOLD, CardSkeletons, Content, GUTTER, Pill, TITLE_FONT } from '@/components/community/ui';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { communityInitials, memberLine } from '@/lib/community';
import {
  fetchComments, fetchCommunity, fetchPerks, fetchPosts, fetchUpcomingEvents,
  type EventRow, type FeedComment, type FeedPost, type PerkRow,
} from '@/lib/communityApi';
import { fetchBoard } from '@/lib/housematesApi';
import type { BoardCard } from '@/lib/housemates';
import type { Community } from '@/types';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'CommunityDetail'>;
type Section = 'posts' | 'housemates' | 'events' | 'perks';

// One community (F18, F19, F21, F22, F23): posts with their latest comments, and for a university its
// housemates, plus events and perks. Anyone signed in can read; joining lets you post.
export default function CommunityDetailScreen() {
  const { session } = useAuth();
  const { communityId } = useRoute<Route>().params;
  return <CommunityDetail key={`${session?.user.id ?? 'out'}-${communityId}`} communityId={communityId} />;
}

function CommunityDetail({ communityId }: { communityId: string }) {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const myId = session?.user.id;
  const { colors } = useTheme();
  const s = useMemo(() => styles(colors), [colors]);

  const [community, setCommunity] = useState<Community | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [section, setSection] = useState<Section>('posts');
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [comments, setComments] = useState<Record<string, FeedComment[]>>({});
  const [cards, setCards] = useState<BoardCard[] | null | 'failed'>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [perks, setPerks] = useState<PerkRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const membership = useMembership();
  const { load: loadMembership } = membership;
  const joined = !!membership.joinedIds?.has(communityId);
  const isCampus = community?.category === 'campus' && !!community.related_university;
  const isMine = isCampus && community?.related_university === profile?.university;

  const load = useCallback(async () => {
    try {
      const [c] = await Promise.all([fetchCommunity(communityId), loadMembership()]);
      setCommunity(c);
      if (!c) return;
      const rows = await fetchPosts(myId, [communityId], 40);
      setPosts(rows);
      setComments(await fetchComments(rows.map((p) => p.id), 2).catch(() => ({})));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [communityId, myId, loadMembership]);

  const loadSection = useCallback(async (which: Section, c: Community | null | undefined) => {
    if (!c) return;
    if (which === 'housemates' && c.related_university) {
      fetchBoard({ university: c.related_university }).then(setCards).catch(() => setCards('failed'));
    } else if (which === 'events') {
      fetchUpcomingEvents(communityId).then(setEvents).catch(() => setEvents([]));
    } else if (which === 'perks') {
      fetchPerks().then(setPerks).catch(() => setPerks([]));
    }
  }, [communityId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); await loadSection(section, community); setRefreshing(false); };
  const pick = (which: Section) => { setSection(which); loadSection(which, community); };

  const setPostList = useCallback((u: (prev: FeedPost[]) => FeedPost[]) => setPosts((prev) => u(prev ?? [])), []);
  const actions = usePostActions(setPostList);
  const housemates = useHousemateActions((userId) => setCards((prev) => (Array.isArray(prev) ? prev.filter((c) => c.user_id !== userId) : prev)));
  const setEventList = useCallback((u: (prev: EventRow[]) => EventRow[]) => setEvents((prev) => u(prev ?? [])), []);
  const going = useGoing(setEventList);
  const perkCodes = usePerkCodes();
  const eventMenu = useSafetyMenu();

  if (community === undefined && !failed) {
    return <View style={[s.container, { paddingTop: insets.top + 20 }]}><CardSkeletons count={3} /></View>;
  }
  if (!community) {
    return (
      <View style={[s.container, { paddingTop: insets.top + 12 }]}>
        <Content>
          <View style={{ paddingHorizontal: GUTTER }}><BackButton style={s.backPlain}><Icon name="arrow-left" size={17} color={colors.ink} /></BackButton></View>
          {failed ? (
            <StateBlock icon="alert-circle" kind="error" title="We could not load this community" body="Check your connection and try again."
              primary={{ label: 'Try again', onPress: () => { setFailed(false); setCommunity(undefined); load(); } }} />
          ) : <StateBlock icon="users" title="This community is no longer here" body="It may have been removed." />}
        </Content>
      </View>
    );
  }

  const sections: { key: Section; label: string }[] = [
    { key: 'posts', label: 'Posts' },
    ...(isCampus ? [{ key: 'housemates' as const, label: 'Housemates' }] : []),
    { key: 'events', label: 'Events' },
    { key: 'perks', label: 'Perks' },
  ];

  const header = (
    <View>
      <View style={[s.hero, { paddingTop: insets.top + 10 }]}>
        <Content>
          <View style={s.heroTop}>
            <BackButton style={s.back}><Icon name="arrow-left" size={17} color="#FFFFFF" /></BackButton>
            <View style={{ flex: 1 }} />
            <Pill
              label={joined ? 'Joined' : membership.joiningId === communityId ? 'Joining…' : 'Join'}
              icon={joined ? 'check' : 'plus'}
              tone={joined ? 'mint' : 'plain'}
              style={joined ? undefined : { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' }}
              disabled={membership.joiningId === communityId || !membership.joinedIds}
              onPress={() => (joined ? setConfirmLeave(true) : membership.join(community))}
              accessibilityLabel={joined ? `Joined ${community.name}. Tap to leave` : `Join ${community.name}`}
              height={44}
            />
          </View>
          <View style={s.heroBody}>
            <View style={s.badge}><Text style={s.badgeText}>{communityInitials(community.name)}</Text></View>
            <Text style={s.heroTitle} accessibilityRole="header">{community.name}</Text>
            <Text style={s.heroMeta}>{memberLine(community.member_count)}{isMine ? ' · Your university' : isCampus ? ' · University' : ' · Interest'}</Text>
          </View>
        </Content>
      </View>
      <Content>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs} accessibilityRole="tablist">
          {sections.map((t) => (
            <Pill key={t.key} label={t.label} tone={section === t.key ? 'ink' : 'plain'} selected={section === t.key} onPress={() => pick(t.key)} />
          ))}
        </ScrollView>
        {section === 'housemates' ? (
          <View style={{ paddingHorizontal: GUTTER, marginBottom: 12, gap: 10 }}>
            <Text style={s.intro}>Students from this university looking to live together. You only see people whose preferences match yours.</Text>
            <OutlineButton label="My housemate card" icon="user" onPress={() => navigation.navigate('MyHousemateCard')} height={44} style={{ alignSelf: 'flex-start', borderRadius: 22 }} />
          </View>
        ) : null}
        {section === 'posts' && !joined && membership.joinedIds ? (
          <View style={s.joinNote}>
            <Icon name="info" size={16} color={colors.mintText} />
            <Text style={s.joinNoteText}>Join to post here. You can read and comment without joining.</Text>
          </View>
        ) : null}
      </Content>
    </View>
  );

  let data: { key: string; node: React.ReactNode }[] = [];
  let empty: React.ReactNode = null;
  if (section === 'posts') {
    if (!posts) empty = <CardSkeletons count={2} />;
    else if (failed) empty = <StateBlock icon="alert-circle" kind="error" title="We could not load the posts" body="Check your connection and try again." primary={{ label: 'Try again', onPress: load }} />;
    else if (!posts.length) empty = <StateBlock icon="message-circle" title="No posts yet" body="Ask the first question." />;
    data = (posts ?? []).map((p) => ({
      key: p.id,
      node: <PostCard post={p} myId={myId} onLike={actions.onLike} onMenu={actions.onMenu} comments={comments[p.id]} />,
    }));
  } else if (section === 'housemates') {
    if (cards === null) empty = <CardSkeletons count={2} height={190} />;
    else if (cards === 'failed') empty = <StateBlock icon="alert-circle" kind="error" title="We could not load housemates" body="Check your connection and try again." primary={{ label: 'Try again', onPress: () => { setCards(null); loadSection('housemates', community); } }} />;
    else if (!cards.length) empty = <StateBlock icon="users" title="No matching cards yet" body="New cards appear after the team has checked them. Make your own card so others can find you." />;
    data = (Array.isArray(cards) ? cards : []).map((c) => ({
      key: c.user_id,
      node: <HousemateCardView card={c} busy={housemates.busyId === c.user_id} onMessage={() => housemates.message(c)} onReport={() => housemates.report(c)} onBlock={() => housemates.block(c)} />,
    }));
  } else if (section === 'events') {
    if (!events) empty = <CardSkeletons count={2} height={130} />;
    else if (!events.length) empty = <StateBlock icon="calendar" title="No events coming up" body="The team adds events. New ones show up here." />;
    data = (events ?? []).map((e) => ({
      key: e.id,
      node: <EventCard event={e} going={going.going.has(e.id)} onToggle={() => going.toggle(e)} onMenu={() => eventMenu.open({ type: 'event', id: e.id })} />,
    }));
  } else {
    if (!perks) empty = <CardSkeletons count={2} height={130} />;
    else if (!perks.length) empty = <StateBlock icon="gift" title="No perks right now" body="Student discounts from brands show up here." />;
    data = (perks ?? []).map((k) => ({
      key: k.id,
      node: <PerkCard perk={k} code={perkCodes.codes[k.id]} loading={perkCodes.busy === k.id} onGetCode={() => perkCodes.getCode(k.id)} />,
    }));
  }

  return (
    <View style={s.container}>
      <FlatList
        data={empty ? [] : data}
        keyExtractor={(d) => d.key}
        renderItem={({ item }) => <Content>{item.node}</Content>}
        ListHeaderComponent={header}
        ListEmptyComponent={empty ? <Content>{empty}</Content> : undefined}
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
      />
      {section === 'posts' && joined ? (
        <AnimatedPressable
          onPress={() => navigation.navigate('CreatePost', { communityId })}
          style={[s.fab, { bottom: insets.bottom + 24 }]} accessibilityRole="button" accessibilityLabel="Write a post"
        >
          <Icon name="plus" size={18} color="#FFFFFF" />
          <Text style={s.fabText}>Write a post</Text>
        </AnimatedPressable>
      ) : null}
      {actions.menus}
      {housemates.element}
      {eventMenu.element}
      <ActionSheet
        visible={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title={`Leave ${community.name}?`}
        message="Its posts stop showing in your Community tab. You can join again any time."
        actions={[{ label: 'Leave', destructive: true, onPress: () => membership.leave(community) }]}
      />
    </View>
  );
}

function styles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    hero: { backgroundColor: colors.coralFill, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingBottom: 22 },
    heroTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: GUTTER },
    back: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    backPlain: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    heroBody: { paddingHorizontal: GUTTER, marginTop: 14, gap: 6 },
    badge: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
    badgeText: { fontFamily: BOLD, fontSize: 18, color: '#FFFFFF' },
    heroTitle: { fontFamily: TITLE_FONT, fontSize: 27, letterSpacing: -0.6, color: '#FFFFFF' },
    heroMeta: { fontSize: 14, color: '#FFFFFF' },
    tabs: { gap: 8, paddingHorizontal: GUTTER, paddingVertical: 16 },
    intro: { fontSize: 14, lineHeight: 20, color: colors.inkBody },
    joinNote: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.mintBg, borderRadius: 14, padding: 12, marginHorizontal: GUTTER, marginBottom: 12 },
    joinNoteText: { flex: 1, fontSize: 13.5, color: colors.mintText },
    fab: {
      position: 'absolute', alignSelf: 'center', height: 54, paddingHorizontal: 22, borderRadius: 27, backgroundColor: colors.coralFill,
      flexDirection: 'row', alignItems: 'center', gap: 8,
      shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
    },
    fabText: { fontFamily: BOLD, fontSize: 16, color: '#FFFFFF' },
  });
}
