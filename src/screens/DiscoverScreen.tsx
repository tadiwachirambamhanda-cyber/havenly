import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { radius, spacing, gradients } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import { communityIcon } from '@/constants/topicIcons';
import type { Community, Post } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Spots/events are static mock content — PROJECT_BRIEF.md section 2 designs
// this to eventually pull from Google Places API + Eventbrite API for live
// data. Search still filters them for real, since that's real (if mock)
// data actually on screen, not faked.
interface Spot { name: string; sub: string; }
interface DiscoverEvent { day: string; month: string; name: string; location: string; }

const SPOTS: Spot[] = [
  { name: 'Nightjar Coffee', sub: 'Al Quoz · Café' },
  { name: 'Sunset Padel Club', sub: 'JBR · Sports' },
  { name: 'La Mer Beach', sub: 'Jumeirah · Beach' },
  { name: 'Alserkal Studios', sub: 'Al Quoz · Art' },
];

const EVENTS: DiscoverEvent[] = [
  { day: '24', month: 'Aug', name: 'AUS Rooftop Movie Night', location: 'American University · Free entry' },
  { day: '27', month: 'Aug', name: 'Alserkal Night Market', location: 'Al Quoz · 6–11pm' },
  { day: '02', month: 'Sep', name: 'UOWD Freshers Mixer', location: 'DIAC · RSVP required' },
];

export default function DiscoverScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [communities, setCommunities] = useState<Community[] | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) { setPosts(null); setCommunities(null); return; }

    const timeout = setTimeout(async () => {
      const [{ data: postData }, { data: communityData }] = await Promise.all([
        supabase.from('posts').select('*, author:profiles!posts_author_id_fkey(*)').ilike('title', `%${trimmed}%`).limit(10),
        supabase.from('communities').select('*').ilike('name', `%${trimmed}%`).limit(10),
      ]);
      setPosts((postData as unknown as Post[]) ?? []);
      setCommunities((communityData as Community[]) ?? []);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const trimmed = query.trim().toLowerCase();
  const isSearching = trimmed.length > 0;
  const filteredSpots = isSearching ? SPOTS.filter((s) => s.name.toLowerCase().includes(trimmed)) : SPOTS;
  const filteredEvents = isSearching ? EVENTS.filter((e) => e.name.toLowerCase().includes(trimmed)) : EVENTS;
  const noResults = isSearching && posts !== null && communities !== null
    && posts.length === 0 && communities.length === 0 && filteredSpots.length === 0 && filteredEvents.length === 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Discover Dubai</Text>

      <View style={styles.searchBar}>
        <Feather name="search" size={14} color={colors.inkSoft} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search spots, events, posts, communities…"
          placeholderTextColor={colors.inkSoft}
          value={query}
          onChangeText={setQuery}
        />
        {isSearching && (
          <Pressable style={styles.clearBtn} onPress={() => setQuery('')}><Feather name="x" size={14} color={colors.inkSoft} /></Pressable>
        )}
      </View>

      {noResults && <Text style={styles.noResults}>No results for "{query.trim()}"</Text>}

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
          {filteredEvents.map((event) => (
            <View key={event.name} style={styles.eventRow}>
              <View style={styles.eventDate}>
                <Text style={styles.eventDay}>{event.day}</Text>
                <Text style={styles.eventMonth}>{event.month}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventName}>{event.name}</Text>
                <Text style={styles.eventLoc}>{event.location}</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
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
  spotScroll: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: 4 },
  spotCard: { width: 150, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  spotImage: { height: 100, width: '100%' },
  spotInfo: { paddingHorizontal: 11, paddingTop: 9, paddingBottom: 11 },
  spotName: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  spotSub: { fontSize: 10.5, color: colors.inkSoft, marginTop: 2 },
  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginBottom: 10,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md,
  },
  eventDate: { width: 46, height: 46, borderRadius: 10, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  eventDay: { fontSize: 15, lineHeight: 17, fontWeight: '800', color: colors.teal },
  eventMonth: { fontSize: 8.5, textTransform: 'uppercase', fontWeight: '800', color: colors.teal },
  eventName: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  eventLoc: { fontSize: 10.5, color: colors.inkSoft, marginTop: 2 },
  });
}
