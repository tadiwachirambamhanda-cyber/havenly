import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, radius, spacing, gradients } from '@/theme/tokens';

// Static mock content for now — PROJECT_BRIEF.md section 2 designs this to
// eventually pull from Google Places API + Eventbrite API for live data.
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
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={styles.title}>Discover Dubai</Text>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchPlaceholder}>Search spots, events, tags…</Text>
      </View>

      <Text style={styles.sectionLabel}>Trending spots near you</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.spotScroll}>
        {SPOTS.map((spot, i) => {
          const [from] = gradients[(i + 2) % gradients.length];
          return (
            <View key={spot.name} style={styles.spotCard}>
              <View style={[styles.spotImage, { backgroundColor: from }]} />
              <View style={styles.spotInfo}>
                <Text style={styles.spotName}>{spot.name}</Text>
                <Text style={styles.spotSub}>{spot.sub}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Text style={styles.sectionLabel}>This week on campus</Text>
      {EVENTS.map((event) => (
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 26, color: colors.ink, paddingHorizontal: spacing.lg, paddingTop: 60 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: spacing.lg, marginTop: 14,
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.white, borderWidth: 1.5,
    borderColor: colors.line, borderRadius: radius.pill,
  },
  searchIcon: { fontSize: 13 },
  searchPlaceholder: { fontSize: 13, color: colors.inkSoft },
  sectionLabel: {
    fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft,
    fontWeight: '600', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 10,
  },
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
