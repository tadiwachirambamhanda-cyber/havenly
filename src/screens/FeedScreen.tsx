import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useNavigation, useFocusEffect, useIsFocused, type CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useUnreadNotifications } from '@/lib/useUnreadNotifications';
import { haptics } from '@/lib/haptics';
import { calmDuration, calmEasing } from '@/lib/animations';
import { annualPrice, cheapestRoom, formatAed } from '@/lib/housing';
import { radius, spacing, gradients } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import { communityIcon } from '@/constants/topicIcons';
import { INTEREST_OPTIONS } from '@/constants/interests';
import { formatCount } from '@/utils/formatCount';
import EmptyState from '@/components/EmptyState';
import Skeleton from '@/components/Skeleton';
import VideoThumb from '@/components/VideoThumb';
import type { Community, Post, Residence } from '@/types';
import type { RootStackParamList, MainTabParamList } from '@/navigation/RootNavigator';

// FeedScreen is actually a Tab.Screen nested inside the root stack, so its
// real navigation prop is both — the tab type for tabPress (only fired on
// the tab navigator, not the stack), the stack type for navigate('PostDetail', ...).
type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Feed'>,
  NativeStackNavigationProp<RootStackParamList>
>;
const PAGE_SIZE = 20;
const NUM_COLUMNS = 2;
// How many recent posts to pull before ranking and trimming down to
// PAGE_SIZE — has to be wider than the display count so a post that's a
// couple of days old but well-matched/well-liked still has a chance to
// outrank something brand new but low-engagement. Small enough not to
// worry about at this app's current post volume.
const RANKING_POOL_SIZE = 100;

// Hand-tuned weights, not learned from any real usage data — there's no
// event-tracking pipeline to learn from yet, so this is a heuristic scorer
// that feels personal, not an actual recommender system. Recency and
// popularity are continuous (recency in (0,1], popularity log-dampened so
// one viral post can't bury everything else); interest/university match are
// flat bonuses since "is this relevant to you" is more a yes/no than a
// gradient.
const RECENCY_WEIGHT = 3;
const POPULARITY_WEIGHT = 1.5;
const INTEREST_BONUS = 2.5;
const UNIVERSITY_BONUS = 1;

function scorePost(post: Post, viewerInterestLabels: Set<string>, viewerUniversity: string | null | undefined): number {
  const ageHours = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
  const recencyScore = 1 / (1 + ageHours / 24);
  const popularityScore = Math.log10(post.like_count + 1);
  const interestBonus = viewerInterestLabels.has(post.tag) ? INTEREST_BONUS : 0;
  const universityBonus = viewerUniversity && post.author?.university === viewerUniversity ? UNIVERSITY_BONUS : 0;
  return recencyScore * RECENCY_WEIGHT + popularityScore * POPULARITY_WEIGHT + interestBonus + universityBonus;
}

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

// Deterministically picks one post out of a candidate pool from a seed —
// stable for as long as the seed is (a day + this viewer's id), so the same
// person sees the same pick all day and it changes at midnight, but two
// different viewers most likely land on two different posts instead of
// everyone piling onto the single highest-ranked one. Not randomness at
// render time, which would reshuffle on every refresh.
function pickDailyPost(candidates: Post[], seed: string): Post | null {
  if (candidates.length === 0) return null;
  return candidates[hashString(seed) % candidates.length];
}

// True masonry: each post gets a deterministic (not fixed) image height,
// then a greedy shortest-column-first pass balances posts across columns by
// estimated total height — plain FlatList numColumns forces equal-height
// rows, which is what made this not-actually-masonry before. Pulled out to
// a plain function (not a hook) so each feed section can balance its own
// posts independently instead of one global column pair.
function balanceColumns(items: Post[]): Post[][] {
  const cols: Post[][] = Array.from({ length: NUM_COLUMNS }, () => []);
  const colHeights = new Array(NUM_COLUMNS).fill(0);
  for (const post of items) {
    const shortest = colHeights.indexOf(Math.min(...colHeights));
    cols[shortest].push(post);
    colHeights[shortest] += estimateCardHeight(post, 110 + (hashString(post.id) % 60));
  }
  return cols;
}

export default function FeedScreen() {
  const navigation = useNavigation<Nav>();
  const { session, profile } = useAuth();
  const { colors } = useTheme();
  const isFocused = useIsFocused();
  const hasUnreadNotifications = useUnreadNotifications();
  const { height: windowHeight } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [communityPosts, setCommunityPosts] = useState<Post[]>([]);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [selectedInterest, setSelectedInterest] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [visibleVideoIds, setVisibleVideoIds] = useState<Set<string>>(new Set());
  const videoCardRefs = useRef<Map<string, View>>(new Map());
  const lastVisibilityCheckRef = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  // Only the interests picked in onboarding/Edit Profile show up as filter
  // chips — same source ProfileScreen's own interest chips use. post.tag
  // values are chosen from the same label set at posting time (TAG_OPTIONS),
  // so matching on the label directly (not the Interest key) works.
  const interestChips = useMemo(
    () => INTEREST_OPTIONS.filter((opt) => profile?.interests.includes(opt.key)),
    [profile]
  );
  // The first picked interest doubles as the one the "Trending in X" section
  // features — same order the filter chips render in, so it's the same one
  // that sits leftmost right above it.
  const topInterestLabel = interestChips[0]?.label ?? null;

  const fetchPosts = useCallback(async (tag: string | null, communityIds: string[]) => {
    let query = supabase
      .from('posts')
      // Explicit FK hint (posts_author_id_fkey) because post_likes creates a second,
      // indirect posts<->profiles path that makes the relationship ambiguous otherwise.
      .select('*, author:profiles!posts_author_id_fkey(*), community:communities(name)')
      .order('created_at', { ascending: false })
      .limit(RANKING_POOL_SIZE);
    if (tag) query = query.eq('tag', tag);
    const { data, error } = await query;
    if (error) { console.error('Failed to fetch posts:', error.message); return; }
    const pool = (data as unknown as Post[]) ?? [];

    const viewerInterestLabels = new Set(
      (profile?.interests ?? [])
        .map((key) => INTEREST_OPTIONS.find((opt) => opt.key === key)?.label)
        .filter((label): label is string => !!label)
    );
    const ranked = [...pool].sort(
      (a, b) => scorePost(b, viewerInterestLabels, profile?.university) - scorePost(a, viewerInterestLabels, profile?.university)
    );
    setPosts(ranked.slice(0, PAGE_SIZE));

    // A specific tag filter is already the flat, single-topic view a chip
    // switches you into — the section rows below (a mix across topics) don't
    // add anything there, so skip fetching them entirely rather than just
    // hiding them.
    if (tag) { setTrendingPosts([]); setCommunityPosts([]); return; }

    const [trendingResult, communityResult] = await Promise.all([
      topInterestLabel
        ? supabase.from('posts').select('*, author:profiles!posts_author_id_fkey(*), community:communities(name)')
            .eq('tag', topInterestLabel).order('like_count', { ascending: false }).limit(10)
        : Promise.resolve(null),
      communityIds.length > 0
        ? supabase.from('posts').select('*, author:profiles!posts_author_id_fkey(*), community:communities(name)')
            .in('community_id', communityIds).order('created_at', { ascending: false }).limit(10)
        : Promise.resolve(null),
    ]);
    setTrendingPosts((trendingResult?.data as unknown as Post[]) ?? []);
    setCommunityPosts((communityResult?.data as unknown as Post[]) ?? []);
  }, [profile, topInterestLabel]);

  // Housing is where Havenly earns, but students only find it if they
  // wander into the tab — so the feed points to it once there's actually
  // something listed (never an empty promise).
  const [residences, setResidences] = useState<Residence[]>([]);
  useFocusEffect(useCallback(() => {
    supabase.from('residences').select('*, room_types(*)').eq('is_active', true)
      .then(({ data }) => setResidences((data as Residence[]) ?? []));
  }, []));
  const housingTeaser = useMemo(() => {
    if (!residences.length) return null;
    const uni = profile?.university ?? null;
    const near = uni ? residences.filter((r) => r.nearby_universities.includes(uni)) : [];
    const pool = near.length ? near : residences;
    const yearly = pool.map(cheapestRoom).filter((r): r is NonNullable<typeof r> => !!r).map(annualPrice);
    return {
      title: near.length ? `${near.length} ${near.length === 1 ? 'place' : 'places'} to live near your uni` : 'Find a place to live near campus',
      priceLine: yearly.length ? `Rooms from ${formatAed(Math.min(...yearly))} a year` : 'Rooms listed by the Havenly team',
      photo: pool.find((r) => r.photo_urls[0])?.photo_urls[0] ?? null,
    };
  }, [residences, profile?.university]);

  const fetchMyCommunities = useCallback(async (): Promise<Community[]> => {
    const userId = session?.user.id;
    if (!userId) { setMyCommunities([]); return []; }
    const { data } = await supabase.from('community_members').select('community:communities(*)').eq('user_id', userId);
    const list = ((data ?? []) as unknown as { community: Community }[]).map((r) => r.community);
    setMyCommunities(list);
    return list;
  }, [session]);

  // Refetches every time Feed regains focus (not just on mount) so a post
  // made in CreatePost, or a like toggled in PostDetail, shows up immediately
  // without needing a manual pull-to-refresh. Same for community membership —
  // joining/leaving in Communities should update this row without a restart.
  // selectedInterest is a dependency too, not just read from state, so
  // tapping a filter chip while already focused re-runs this immediately —
  // that's the only signal this effect gets that the filter changed.
  // Communities are fetched first (not in parallel with posts) because the
  // "New in your communities" section needs their ids — fetchPosts can't
  // read them off state since fetchMyCommunities' own setState wouldn't have
  // landed yet if both ran at once.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (!hasLoadedOnce) setLoading(true);
        const communities = await fetchMyCommunities();
        await fetchPosts(selectedInterest, communities.map((c) => c.id));
        setLoading(false);
        setHasLoadedOnce(true);
      })();
    }, [fetchPosts, fetchMyCommunities, hasLoadedOnce, selectedInterest])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const communities = await fetchMyCommunities();
    await fetchPosts(selectedInterest, communities.map((c) => c.id));
    setRefreshing(false);
  }, [fetchPosts, fetchMyCommunities, selectedInterest]);

  // Shared by the "havenly." wordmark and re-tapping the already-active Feed
  // tab — both the scroll-to-top and the refresh, same as tapping the active
  // tab does in most feed apps.
  const refreshFeed = useCallback(() => {
    haptics.tap();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    onRefresh();
  }, [onRefresh]);

  // Fires whenever the Feed tab button is pressed, whether or not it's
  // already the active tab — react-navigation's own tabPress event, not
  // anything TabBar has to cooperate with.
  useEffect(() => {
    return navigation.addListener('tabPress', () => {
      if (navigation.isFocused()) refreshFeed();
    });
  }, [navigation, refreshFeed]);

  // Switching the filter swaps the whole feed's shape — the multi-section
  // layout (daily pick hero + Picked for you / Trending / community rows)
  // for a flat single-topic grid, or back. If you're scrolled down when
  // that swap happens, entirely different content lands under your
  // viewport with no warning, which reads as a glitch — scrolling back to
  // the top first makes the swap happen somewhere you're already looking.
  const toggleInterestFilter = useCallback((label: string) => {
    haptics.tap();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setSelectedInterest((prev) => (prev === label ? null : label));
  }, []);

  // Selected gets the same coral-to-gold gradient treatment as the streak
  // badge, instead of a plain solid fill — shadow lives on a separate outer
  // View from the gradient's clip for the same reason as the streak badge:
  // overflow: hidden (needed to clip the gradient to the pill) would
  // otherwise clip the shadow itself into invisibility on iOS.
  const renderInterestChip = (key: string, label: string, isSelected: boolean, onPress: () => void) =>
    isSelected ? (
      <View key={key} style={styles.interestChipShadow}>
        <AnimatedPressable style={styles.interestChipSelected} onPress={onPress}>
          <LinearGradient colors={['#FF7A45', '#E3A23A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Text style={styles.interestChipTextSelected}>{label}</Text>
        </AnimatedPressable>
      </View>
    ) : (
      <AnimatedPressable key={key} style={styles.interestChip} onPress={onPress}>
        <Text style={styles.interestChipText}>{label}</Text>
      </AnimatedPressable>
    );

  // The masonry layout is a plain ScrollView (FlatList's numColumns forces
  // equal-height rows, which is exactly what breaks true masonry — see the
  // comment below), so there's no built-in onViewableItemsChanged to lean
  // on the way ProfileScreen's grid does. Measuring each video card's own
  // on-screen position directly gets the same result without needing one.
  const checkVideoVisibility = useCallback(async () => {
    // Keyed by "<section>:<post id>", not just post id — the same post can
    // now render in more than one section at once (e.g. also trending in
    // its own tag), and each on-screen instance needs its own measured
    // position. Keying by post id alone meant two instances shared one
    // tracked ref, so whichever wasn't on screen paused BOTH copies.
    const videoEntries: [string, Post][] = [
      ...posts.map((p): [string, Post] => [`picked:${p.id}`, p]),
      ...trendingPosts.map((p): [string, Post] => [`trending:${p.id}`, p]),
      ...communityPosts.map((p): [string, Post] => [`community:${p.id}`, p]),
    ].filter(([, p]) => p.video_url);
    if (videoEntries.length === 0) return;
    const results = await Promise.all(videoEntries.map(([cardKey]) => new Promise<[string, boolean]>((resolve) => {
      const ref = videoCardRefs.current.get(cardKey);
      if (!ref) { resolve([cardKey, false]); return; }
      ref.measureInWindow((_x, y, _width, height) => {
        resolve([cardKey, y + height > 0 && y < windowHeight]);
      });
    })));
    const next = new Set(results.filter(([, visible]) => visible).map(([key]) => key));
    setVisibleVideoIds((prev) => {
      if (prev.size === next.size && [...prev].every((id) => next.has(id))) return prev;
      return next;
    });
  }, [posts, trendingPosts, communityPosts, windowHeight]);

  const onScroll = useCallback((_e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const now = Date.now();
    if (now - lastVisibilityCheckRef.current < 200) return;
    lastVisibilityCheckRef.current = now;
    checkVideoVisibility();
  }, [checkVideoVisibility]);

  // Posts (and therefore which cards exist at all) only change on load or
  // refresh, not on every scroll — run one check whenever that happens so
  // videos already on screen start playing without needing a scroll first.
  useEffect(() => { checkVideoVisibility(); }, [checkVideoVisibility]);

  const pickedColumns = useMemo(() => balanceColumns(posts), [posts]);
  const trendingColumns = useMemo(() => balanceColumns(trendingPosts), [trendingPosts]);
  const communityColumns = useMemo(() => balanceColumns(communityPosts), [communityPosts]);

  // Prefers the trending pool (already popularity-sorted within the
  // viewer's top interest) over the blended "Picked for you" ranking, so
  // the daily pick skews toward what they actually care about rather than
  // whatever the recency/popularity blend happens to surface.
  const dailyPick = useMemo(() => {
    const candidates = trendingPosts.length > 0 ? trendingPosts : posts;
    const daySeed = new Date().toISOString().slice(0, 10);
    return pickDailyPost(candidates, `${daySeed}:${session?.user.id ?? 'anon'}`);
  }, [trendingPosts, posts, session]);

  // sectionKey distinguishes the same post rendered in more than one
  // section at once (see checkVideoVisibility) — doesn't need to be
  // anything but stable and unique per section.
  const renderCard = (item: Post, sectionKey: string, index = 0) => {
    const hash = hashString(item.id);
    const [from, to] = gradients[hash % gradients.length];
    const imageHeight = 110 + (hash % 60);
    const cardKey = `${sectionKey}:${item.id}`;
    return (
      <Animated.View key={cardKey} entering={FadeInDown.delay(Math.min(index, 6) * 60).duration(calmDuration).easing(calmEasing)}>
      <Pressable
        style={[styles.card, item.is_editorial && styles.cardEditorial]}
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
      >
        <View style={[styles.cardImage, { height: imageHeight }]}>
          <LinearGradient colors={[from, to]} style={StyleSheet.absoluteFill} />
          {item.video_url ? (
            <View
              style={StyleSheet.absoluteFill}
              ref={(el) => { if (el) videoCardRefs.current.set(cardKey, el); else videoCardRefs.current.delete(cardKey); }}
            >
              <VideoThumb uri={item.video_url} isVisible={isFocused && visibleVideoIds.has(cardKey)} />
            </View>
          ) : item.image_url ? (
            <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : null}
          {item.is_editorial && (
            <View style={styles.editorialBadge}><Text style={styles.editorialBadgeText}>★ Havenly Picks</Text></View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTag}>{item.tag}</Text>
          {item.community?.name && (
            <View style={styles.communityBadge}>
              <Feather name="users" size={9} color={colors.teal} />
              <Text style={styles.communityBadgeText} numberOfLines={1}>{item.community.name}</Text>
            </View>
          )}
          <Text style={styles.cardTitle} numberOfLines={3}>{item.title}</Text>
          <View style={styles.cardMeta}>
            <Pressable
              style={styles.cardUserTap}
              disabled={item.is_editorial}
              onPress={() => navigation.navigate('UserProfile', { userId: item.author_id })}
              hitSlop={4}
            >
              <Text style={styles.cardUser} numberOfLines={1}>
                {item.is_editorial ? 'Havenly Editorial' : `@${item.author?.username ?? 'user'}`}
              </Text>
            </Pressable>
            <View style={styles.cardLikesRow}>
              <Feather name="heart" size={11} color={colors.inkSoft} />
              <Text style={styles.cardLikes}>{formatCount(item.like_count)}</Text>
            </View>
          </View>
        </View>
      </Pressable>
      </Animated.View>
    );
  };

  const renderSection = (title: string, columns: Post[][], sectionKey: string) => (
    <View key={title}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.masonryRow}>
        {columns.map((col, i) => (
          <View key={i} style={styles.masonryColumn}>{col.map((post, idx) => renderCard(post, sectionKey, idx))}</View>
        ))}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brand}>havenly.</Text>
          </View>
        </View>
        <View style={styles.masonryRow}>
          {[0, 1].map((col) => (
            <View key={col} style={styles.masonryColumn}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.card}>
                  <Skeleton style={{ height: 110 + ((col + i) % 3) * 30, borderRadius: 0 }} />
                  <View style={styles.cardBody}>
                    <Skeleton style={{ height: 9, width: '40%', marginBottom: 8 }} />
                    <Skeleton style={{ height: 13, width: '85%', marginBottom: 6 }} />
                    <Skeleton style={{ height: 13, width: '60%' }} />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.brandRow} onPress={refreshFeed} accessibilityLabel="Refresh feed">
          <View style={styles.brandDot} />
          <Text style={styles.brand}>havenly.</Text>
        </Pressable>
        <View style={styles.topBarActions}>
          {!!profile?.current_streak && (
            <View style={styles.streakBadgeShadow}>
              <AnimatedPressable
                style={styles.streakBadge}
                onPress={() => { haptics.tap(); navigation.navigate('Offers'); }}
                accessibilityLabel={`${profile.current_streak} day streak — view perks`}
              >
                <LinearGradient
                  colors={['#FF7A45', '#E3A23A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.streakBadgeText}>🔥 {profile.current_streak}</Text>
              </AnimatedPressable>
            </View>
          )}
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Notifications')} accessibilityLabel="Notifications">
            <Feather name="bell" size={17} color={colors.ink} />
            {hasUnreadNotifications && <View style={styles.iconBtnDot} />}
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Communities')} accessibilityLabel="Communities">
            <Feather name="users" size={17} color={colors.ink} />
          </Pressable>
        </View>
      </View>
      {interestChips.length > 0 && (
        // Pinned above the scrolling feed (unlike myCommunitiesRow below,
        // which scrolls away with the rest) since it's an active filter
        // control — you're more likely to want to keep switching it while
        // scrolling through results than a static row of shortcuts. Needs
        // its own flexGrow/flexShrink: 0 here — placed directly in the
        // column flex layout (not nested inside the main ScrollView the way
        // myCommunitiesRow is), react-native-web otherwise squeezes this
        // row below its content's natural height, clipping the chips.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={styles.interestRow}
        >
          {renderInterestChip('all', 'All', !selectedInterest, () => {
            haptics.tap(); scrollRef.current?.scrollTo({ y: 0, animated: true }); setSelectedInterest(null);
          })}
          {interestChips.map((opt) => {
            const isSelected = selectedInterest === opt.label;
            return renderInterestChip(opt.key, opt.label, isSelected, () => toggleInterestFilter(opt.label));
          })}
        </ScrollView>
      )}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
        onScroll={onScroll}
        scrollEventThrottle={200}
      >
        {myCommunities.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.myCommunitiesRow}>
            {myCommunities.map((c) => (
              <Pressable key={c.id} style={styles.myCommunityChip} onPress={() => navigation.navigate('CommunityDetail', { communityId: c.id })}>
                <Feather name={communityIcon(c)} size={12} color={colors.teal} />
                <Text style={styles.myCommunityChipText} numberOfLines={1}>{c.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {selectedInterest ? (
          // A chip is active — one flat, single-topic grid, same as before
          // sections existed. "Trending in X" / "New in your communities"
          // don't add anything once you've already filtered to one topic.
          posts.length === 0 ? (
            <EmptyState icon="image" text={`No ${selectedInterest} posts yet.`} />
          ) : (
            <View style={styles.masonryRow}>
              {pickedColumns.map((col, i) => (
                <View key={i} style={styles.masonryColumn}>{col.map((post) => renderCard(post, 'flat'))}</View>
              ))}
            </View>
          )
        ) : posts.length === 0 && trendingPosts.length === 0 && communityPosts.length === 0 ? (
          <EmptyState icon="image" text="Nothing here yet — be the first to post." />
        ) : (
          <>
            {dailyPick && (
              <Pressable
                style={styles.dailyPickCard}
                onPress={() => navigation.navigate('PostDetail', { postId: dailyPick.id })}
              >
                {dailyPick.image_url ? (
                  <Image source={{ uri: dailyPick.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                ) : (
                  <LinearGradient colors={gradients[hashString(dailyPick.id) % gradients.length]} style={StyleSheet.absoluteFill} />
                )}
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFill} />
                <View style={styles.dailyPickBody}>
                  <Text style={styles.dailyPickEyebrow}>★ Today's pick</Text>
                  <Text style={styles.dailyPickTitle} numberOfLines={2}>{dailyPick.title}</Text>
                  <Text style={styles.dailyPickMeta}>
                    {dailyPick.tag} · {dailyPick.is_editorial ? 'Havenly Editorial' : `@${dailyPick.author?.username ?? 'user'}`}
                  </Text>
                </View>
              </Pressable>
            )}
            {posts.length > 0 && renderSection('Picked for you', pickedColumns, 'picked')}
            {housingTeaser && (
              <AnimatedPressable
                style={styles.housingCard}
                scaleTo={0.98}
                onPress={() => navigation.navigate('Housing')}
                accessibilityLabel="Find housing"
              >
                {housingTeaser.photo ? (
                  <Image source={{ uri: housingTeaser.photo }} style={styles.housingPhoto} contentFit="cover" transition={200} />
                ) : (
                  <View style={[styles.housingPhoto, styles.housingPhotoEmpty]}>
                    <Feather name="home" size={22} color={colors.gold} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.housingEyebrow}>Housing</Text>
                  <Text style={styles.housingTitle} numberOfLines={2}>{housingTeaser.title}</Text>
                  <Text style={styles.housingSub} numberOfLines={1}>{housingTeaser.priceLine}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.inkSoft} />
              </AnimatedPressable>
            )}
            {topInterestLabel && trendingPosts.length > 0 && renderSection(`Trending in ${topInterestLabel}`, trendingColumns, 'trending')}
            {communityPosts.length > 0 && renderSection('New in your communities', communityColumns, 'community')}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: 60, paddingBottom: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral },
  brand: { fontFamily: 'Fraunces_700Bold_Italic', fontSize: 24, color: colors.ink },
  topBarActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  iconBtnDot: { position: 'absolute', top: 6, right: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral, borderWidth: 1.5, borderColor: colors.white },
  // Shadow and the gradient's clip live on separate layers — overflow:
  // hidden (needed to clip the gradient to the pill) would otherwise clip
  // the shadow itself into invisibility on iOS.
  streakBadgeShadow: {
    borderRadius: 18, shadowColor: '#FF5A3C', shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  streakBadge: { height: 36, paddingHorizontal: 13, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  streakBadgeText: { fontSize: 13.5, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.1 },
  interestRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  interestChip: {
    backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line,
    borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 14,
  },
  interestChipShadow: {
    borderRadius: radius.pill, shadowColor: '#FF5A3C', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  interestChipSelected: {
    borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  interestChipText: { fontSize: 11.5, fontWeight: '700', color: colors.ink },
  interestChipTextSelected: { fontSize: 11.5, fontWeight: '800', color: '#FFFFFF' },
  myCommunitiesRow: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  myCommunityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderWidth: 1,
    borderColor: colors.line, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 12, maxWidth: 160,
  },
  myCommunityChipText: { fontSize: 11.5, fontWeight: '700', color: colors.ink },
  communityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  communityBadgeText: { fontSize: 9.5, fontWeight: '700', color: colors.teal },
  sectionLabel: {
    fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft,
    fontWeight: '600', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 10,
  },
  housingCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: spacing.lg, marginTop: spacing.sm,
    marginBottom: spacing.md, padding: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md,
  },
  housingPhoto: { width: 64, height: 64, borderRadius: 12 },
  housingPhotoEmpty: { backgroundColor: `${colors.gold}26`, alignItems: 'center', justifyContent: 'center' },
  housingEyebrow: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 10, textTransform: 'uppercase', color: colors.teal, fontWeight: '700' },
  housingTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 15.5, color: colors.ink, marginTop: 2, lineHeight: 20 },
  housingSub: { fontSize: 12, color: colors.inkSoft, marginTop: 3 },
  dailyPickCard: {
    marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md,
    height: 190, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end',
  },
  dailyPickBody: { padding: spacing.lg },
  // Literal white/gold regardless of theme — this card is always a photo or
  // gradient with a dark overlay gradient under it, same reasoning as the
  // full-screen video layout's own white text.
  dailyPickEyebrow: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 10.5, color: colors.gold, textTransform: 'uppercase', fontWeight: '700', marginBottom: 6 },
  dailyPickTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 19, color: 'white', lineHeight: 24 },
  dailyPickMeta: { fontSize: 11.5, color: 'rgba(255,255,255,0.8)', fontWeight: '600', marginTop: 6 },
  masonryRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  masonryColumn: { flex: 1, gap: spacing.sm },
  card: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  cardEditorial: { borderColor: colors.gold, borderWidth: 1.5 },
  cardImage: { justifyContent: 'flex-start' },
  // Fixed dark plaque regardless of theme — colors.ink would flip to cream in
  // dark mode and break the gold text's contrast, so this one stays literal.
  editorialBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#20261F', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  editorialBadgeText: { color: colors.gold, fontSize: 9, fontWeight: '700' },
  cardBody: { padding: 11 },
  cardTag: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 9.5, color: colors.teal, textTransform: 'uppercase' },
  cardTitle: { fontSize: 13.5, fontWeight: '700', marginTop: 5, color: colors.ink, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 },
  cardUserTap: { flex: 1 },
  cardUser: { fontSize: 11, color: colors.inkSoft, fontWeight: '600' },
  cardLikesRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardLikes: { fontSize: 11, color: colors.inkSoft, fontWeight: '600' },
  });
}
