import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { haptics } from '@/lib/haptics';
import { formatCount } from '@/utils/formatCount';
import { radius, spacing, gradients } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import { communityIcon, interestIcon } from '@/constants/topicIcons';
import { INTEREST_OPTIONS } from '@/constants/interests';
import EmptyState from '@/components/EmptyState';
import ActionSheet from '@/components/ActionSheet';
import type { Community, HavenlyEvent, Interest, Post, Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Spots are still static mock content — PROJECT_BRIEF.md section 2 designs
// this to eventually pull from Google Places API for live data. Search
// still filters them for real, since that's real (if mock) data actually
// on screen, not faked. Events are real now (see `events` table) — only
// profiles.is_admin accounts can create/delete them (Settings → Create
// event), everyone else just views and marks interest.
interface Spot { name: string; sub: string; }

const SPOTS: Spot[] = [
  { name: 'Nightjar Coffee', sub: 'Al Quoz · Café' },
  { name: 'Sunset Padel Club', sub: 'JBR · Sports' },
  { name: 'La Mer Beach', sub: 'Jumeirah · Beach' },
  { name: 'Alserkal Studios', sub: 'Al Quoz · Art' },
];

// "Sara is going" / "Sara and Amir are going" / "Sara, Amir and 3 others are going".
function friendsGoingLabel(friends: Profile[]): string {
  const names = friends.map((f) => f.display_name);
  if (names.length === 1) return `${names[0]} is going`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are going`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]} are going`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others are going`;
}

export default function DiscoverScreen() {
  const navigation = useNavigation<Nav>();
  const { session, profile, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [communities, setCommunities] = useState<Community[] | null>(null);
  const [events, setEvents] = useState<HavenlyEvent[] | null>(null);
  const [myInterestIds, setMyInterestIds] = useState<Set<string>>(new Set());
  const [friendsGoing, setFriendsGoing] = useState<Map<string, Profile[]>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [addingInterest, setAddingInterest] = useState<Interest | null>(null);

  // Lets Discover double as a lightweight way to grow your interests beyond
  // what you picked at onboarding — searching a topic or browsing "More
  // interests to explore" both write straight to profiles.interests, same
  // column Edit Profile's full picker edits. The Feed (filter chips, the
  // ranking bonus, "Trending in X") all read that same column, so this
  // takes effect there immediately without any extra wiring.
  const toggleProfileInterest = useCallback(async (key: Interest) => {
    if (!session?.user.id || !profile) return;
    haptics.tap();
    setAddingInterest(key);
    const has = profile.interests.includes(key);
    const nextInterests = has ? profile.interests.filter((k) => k !== key) : [...profile.interests, key];
    const { error } = await supabase.from('profiles').update({ interests: nextInterests }).eq('id', session.user.id);
    if (!error) await refreshProfile();
    setAddingInterest(null);
  }, [session, profile, refreshProfile]);

  const loadEvents = useCallback(async () => {
    const { data: eventData } = await supabase.from('events').select('*')
      .gte('event_date', new Date().toISOString()).order('event_date', { ascending: true }).limit(10);
    const eventList = (eventData as HavenlyEvent[]) ?? [];
    setEvents(eventList);

    const userId = session?.user.id;
    if (!userId || eventList.length === 0) { setMyInterestIds(new Set()); setFriendsGoing(new Map()); return; }

    const eventIds = eventList.map((e) => e.id);
    const [{ data: mineData }, { data: followData }] = await Promise.all([
      supabase.from('event_interests').select('event_id').eq('user_id', userId).in('event_id', eventIds),
      supabase.from('follows').select('following_id').eq('follower_id', userId),
    ]);
    setMyInterestIds(new Set(((mineData ?? []) as { event_id: string }[]).map((row) => row.event_id)));

    const followingIds = ((followData ?? []) as { following_id: string }[]).map((row) => row.following_id);
    if (followingIds.length === 0) { setFriendsGoing(new Map()); return; }

    const { data: interestData } = await supabase.from('event_interests')
      .select('event_id, user:profiles(*)')
      .in('event_id', eventIds).in('user_id', followingIds);

    const grouped = new Map<string, Profile[]>();
    for (const row of (interestData as unknown as { event_id: string; user: Profile | null }[]) ?? []) {
      if (!row.user) continue;
      const list = grouped.get(row.event_id) ?? [];
      list.push(row.user);
      grouped.set(row.event_id, list);
    }
    setFriendsGoing(grouped);
  }, [session]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const toggleInterest = useCallback(async (eventId: string) => {
    if (!session?.user.id) return;
    haptics.tap();
    const wasInterested = myInterestIds.has(eventId);
    const bump = (n: number) => Math.max(n + (wasInterested ? -1 : 1), 0);
    const unbump = (n: number) => Math.max(n + (wasInterested ? 1 : -1), 0);

    setEvents((prev) => prev?.map((e) => (e.id === eventId ? { ...e, interested_count: bump(e.interested_count) } : e)) ?? prev);
    setMyInterestIds((prev) => {
      const next = new Set(prev);
      if (wasInterested) next.delete(eventId); else next.add(eventId);
      return next;
    });

    const { error } = await supabase.rpc('toggle_event_interest', { event_id_input: eventId });
    if (error) {
      // Revert the optimistic update if the write actually failed.
      setEvents((prev) => prev?.map((e) => (e.id === eventId ? { ...e, interested_count: unbump(e.interested_count) } : e)) ?? prev);
      setMyInterestIds((prev) => {
        const next = new Set(prev);
        if (wasInterested) next.add(eventId); else next.delete(eventId);
        return next;
      });
    }
  }, [session, myInterestIds]);

  const [deleteEventTarget, setDeleteEventTarget] = useState<HavenlyEvent | null>(null);

  const deleteEvent = useCallback((event: HavenlyEvent) => setDeleteEventTarget(event), []);

  const confirmDeleteEvent = useCallback(async () => {
    const event = deleteEventTarget;
    if (!event) return;
    const { error } = await supabase.from('events').delete().eq('id', event.id);
    if (!error) setEvents((prev) => prev?.filter((e) => e.id !== event.id) ?? prev);
  }, [deleteEventTarget]);

  const runSearch = useCallback(async (trimmed: string) => {
    const [{ data: postData }, { data: communityData }] = await Promise.all([
      supabase.from('posts').select('*, author:profiles!posts_author_id_fkey(*)').ilike('title', `%${trimmed}%`).limit(10),
      supabase.from('communities').select('*').ilike('name', `%${trimmed}%`).limit(10),
    ]);
    setPosts((postData as unknown as Post[]) ?? []);
    setCommunities((communityData as Community[]) ?? []);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) { setPosts(null); setCommunities(null); return; }
    const timeout = setTimeout(() => runSearch(trimmed), 300);
    return () => clearTimeout(timeout);
  }, [query, runSearch]);

  const onRefresh = useCallback(async () => {
    const trimmed = query.trim();
    setRefreshing(true);
    await Promise.all([trimmed ? runSearch(trimmed) : Promise.resolve(), loadEvents()]);
    setRefreshing(false);
  }, [query, runSearch, loadEvents]);

  const trimmed = query.trim().toLowerCase();
  const isSearching = trimmed.length > 0;
  const filteredSpots = isSearching ? SPOTS.filter((s) => s.name.toLowerCase().includes(trimmed)) : SPOTS;
  const eventList = events ?? [];
  const filteredEvents = isSearching ? eventList.filter((e) => e.title.toLowerCase().includes(trimmed)) : eventList;
  const matchedInterests = isSearching ? INTEREST_OPTIONS.filter((opt) => opt.label.toLowerCase().includes(trimmed)) : [];
  // Only what's not already picked — once added, an interest naturally
  // drops off this row on its own (profile.interests now includes it).
  const exploreInterests = INTEREST_OPTIONS.filter((opt) => !profile?.interests.includes(opt.key));
  const noResults = isSearching && posts !== null && communities !== null
    && posts.length === 0 && communities.length === 0 && filteredSpots.length === 0 && filteredEvents.length === 0
    && matchedInterests.length === 0;

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
    >
      <Text style={styles.title}>Discover Dubai</Text>

      <View style={styles.searchBar}>
        <Feather name="search" size={14} color={colors.inkSoft} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search interests, posts, communities, events…"
          placeholderTextColor={colors.inkSoft}
          value={query}
          onChangeText={setQuery}
        />
        {isSearching && (
          <Pressable style={styles.clearBtn} onPress={() => setQuery('')} accessibilityLabel="Clear search">
            <Feather name="x" size={14} color={colors.inkSoft} />
          </Pressable>
        )}
      </View>

      {noResults && <EmptyState icon="search" text={`No results for "${query.trim()}"`} />}

      {isSearching && matchedInterests.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Interests</Text>
          {matchedInterests.map((opt) => {
            const added = profile?.interests.includes(opt.key) ?? false;
            return (
              <View key={opt.key} style={styles.resultRow}>
                <View style={styles.resultIcon}><Feather name={interestIcon(opt.key)} size={15} color={colors.coral} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle}>{opt.label}</Text>
                  <Text style={styles.resultSub}>Interest</Text>
                </View>
                <Pressable
                  style={[styles.addInterestBtn, added && styles.addInterestBtnAdded]}
                  onPress={() => toggleProfileInterest(opt.key)}
                  disabled={addingInterest === opt.key}
                  accessibilityLabel={added ? `Remove ${opt.label} from your interests` : `Add ${opt.label} to your interests`}
                >
                  {addingInterest === opt.key ? (
                    <ActivityIndicator size="small" color={added ? colors.inkSoft : colors.coral} />
                  ) : (
                    <Text style={[styles.addInterestBtnText, added && styles.addInterestBtnTextAdded]}>{added ? 'Added ✓' : '+ Add'}</Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </>
      )}

      {!isSearching && exploreInterests.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>More interests to explore</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exploreInterestsRow}>
            {exploreInterests.map((opt) => (
              <Pressable
                key={opt.key}
                style={styles.exploreInterestChip}
                onPress={() => toggleProfileInterest(opt.key)}
                disabled={addingInterest === opt.key}
                accessibilityLabel={`Add ${opt.label} to your interests`}
              >
                {addingInterest === opt.key ? (
                  <ActivityIndicator size="small" color={colors.ink} />
                ) : (
                  <>
                    <Feather name={interestIcon(opt.key)} size={13} color={colors.ink} />
                    <Text style={styles.exploreInterestChipText}>{opt.label}</Text>
                  </>
                )}
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {isSearching && posts !== null && posts.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Posts</Text>
          {posts.map((post) => (
            <Pressable key={post.id} style={styles.resultRow} onPress={() => navigation.navigate('PostDetail', { postId: post.id })}>
              <View style={styles.resultIcon}><Feather name="file-text" size={15} color={colors.inkSoft} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTitle} numberOfLines={1}>{post.title}</Text>
                <Text style={styles.resultSub}>{post.tag}</Text>
              </View>
            </Pressable>
          ))}
        </>
      )}

      {isSearching && communities !== null && communities.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Communities</Text>
          {communities.map((c) => (
            <Pressable key={c.id} style={styles.resultRow} onPress={() => navigation.navigate('CommunityDetail', { communityId: c.id })}>
              <View style={styles.resultIcon}><Feather name={communityIcon(c)} size={15} color={colors.teal} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTitle}>{c.name}</Text>
                <Text style={styles.resultSub}>{c.member_count} members</Text>
              </View>
            </Pressable>
          ))}
        </>
      )}

      {filteredSpots.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>{isSearching ? 'Spots' : 'Trending spots near you'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.spotScroll}>
            {filteredSpots.map((spot, i) => {
              const [from, to] = gradients[(i + 2) % gradients.length];
              return (
                <View key={spot.name} style={styles.spotCard}>
                  <LinearGradient colors={[from, to]} style={styles.spotImage} />
                  <View style={styles.spotInfo}>
                    <Text style={styles.spotName}>{spot.name}</Text>
                    <Text style={styles.spotSub}>{spot.sub}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </>
      )}

      {filteredEvents.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>{isSearching ? 'Events' : 'This week on campus'}</Text>
          {filteredEvents.map((event) => {
            const date = new Date(event.event_date);
            const interested = myInterestIds.has(event.id);
            const friends = friendsGoing.get(event.id) ?? [];
            return (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventRow}>
                  <View style={styles.eventDate}>
                    <Text style={styles.eventDay}>{date.getDate()}</Text>
                    <Text style={styles.eventMonth}>{date.toLocaleDateString('en-US', { month: 'short' })}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eventName}>{event.title}</Text>
                    <Text style={styles.eventLoc}>{event.location}</Text>
                  </View>
                  <View style={styles.eventActions}>
                    <Pressable
                      style={styles.interestBtn}
                      onPress={() => toggleInterest(event.id)}
                      hitSlop={8}
                      accessibilityLabel={interested ? "Remove interest in this event" : "I'm interested in this event"}
                    >
                      <Feather name="heart" size={15} color={interested ? colors.coral : colors.inkSoft} />
                      <Text style={[styles.interestCount, interested && styles.interestCountActive]}>
                        {formatCount(event.interested_count)}
                      </Text>
                    </Pressable>
                    {profile?.is_admin && (
                      <Pressable
                        style={styles.deleteBtn}
                        onPress={() => deleteEvent(event)}
                        hitSlop={8}
                        accessibilityLabel="Delete event"
                      >
                        <Feather name="trash-2" size={13} color={colors.inkSoft} />
                      </Pressable>
                    )}
                  </View>
                </View>
                {friends.length > 0 && (
                  <View style={styles.friendsRow}>
                    <View style={styles.friendsAvatars}>
                      {friends.slice(0, 3).map((friend, i) =>
                        friend.avatar_url ? (
                          <Image
                            key={friend.id}
                            source={{ uri: friend.avatar_url }}
                            style={[styles.friendAvatar, i > 0 && { marginLeft: -8 }]}
                          />
                        ) : (
                          <LinearGradient
                            key={friend.id}
                            colors={['#0F8B82', '#FF5A3C']}
                            style={[styles.friendAvatar, i > 0 && { marginLeft: -8 }]}
                          />
                        )
                      )}
                    </View>
                    <Text style={styles.friendsText} numberOfLines={1}>{friendsGoingLabel(friends)}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
    <ActionSheet
      visible={!!deleteEventTarget}
      onClose={() => setDeleteEventTarget(null)}
      title="Delete event?"
      message={deleteEventTarget ? `"${deleteEventTarget.title}" will be removed for everyone.` : undefined}
      actions={[{ label: 'Delete', destructive: true, onPress: confirmDeleteEvent }]}
    />
    </>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 26, color: colors.ink, paddingHorizontal: spacing.lg, paddingTop: 60 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: spacing.lg, marginTop: 14,
    paddingHorizontal: 16, paddingVertical: 4, backgroundColor: colors.white, borderWidth: 1.5,
    borderColor: colors.line, borderRadius: radius.pill,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.ink, paddingVertical: 10 },
  clearBtn: { paddingHorizontal: 4 },
  noResults: { color: colors.inkSoft, fontSize: 13, textAlign: 'center', marginTop: 24 },
  sectionLabel: {
    fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft,
    fontWeight: '600', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 10,
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md,
  },
  resultIcon: { width: 32, alignItems: 'center' },
  resultTitle: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  resultSub: { fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  addInterestBtn: {
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill,
    borderWidth: 1.5, borderColor: colors.coral, minWidth: 66, alignItems: 'center',
  },
  addInterestBtnAdded: { borderColor: colors.line, backgroundColor: colors.sandDeep },
  addInterestBtnText: { fontSize: 11.5, fontWeight: '700', color: colors.coral },
  addInterestBtnTextAdded: { color: colors.inkSoft },
  exploreInterestsRow: { gap: 8, paddingHorizontal: spacing.lg, paddingBottom: 4 },
  exploreInterestChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderWidth: 1.5,
    borderColor: colors.line, borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 14,
  },
  exploreInterestChipText: { fontSize: 12.5, fontWeight: '600', color: colors.ink },
  spotScroll: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: 4 },
  spotCard: { width: 150, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  spotImage: { height: 100, width: '100%' },
  spotInfo: { paddingHorizontal: 11, paddingTop: 9, paddingBottom: 11 },
  spotName: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  spotSub: { fontSize: 10.5, color: colors.inkSoft, marginTop: 2 },
  eventCard: {
    marginHorizontal: spacing.lg, marginBottom: 10,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md,
  },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  eventDate: { width: 46, height: 46, borderRadius: 10, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  eventDay: { fontSize: 15, lineHeight: 17, fontWeight: '800', color: colors.teal },
  eventMonth: { fontSize: 8.5, textTransform: 'uppercase', fontWeight: '800', color: colors.teal },
  eventName: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  eventLoc: { fontSize: 10.5, color: colors.inkSoft, marginTop: 2 },
  eventActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  interestBtn: { alignItems: 'center', gap: 2, paddingLeft: 4 },
  interestCount: { fontSize: 10, fontWeight: '700', color: colors.inkSoft },
  interestCountActive: { color: colors.coral },
  deleteBtn: { padding: 4 },
  friendsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.line,
  },
  friendsAvatars: { flexDirection: 'row' },
  friendAvatar: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.white },
  friendsText: { flex: 1, fontSize: 10.5, color: colors.inkSoft, fontWeight: '600' },
  });
}
