import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Community, CommunityCategory } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const SECTION_TITLES: Record<CommunityCategory, string> = {
  interest: 'Based on your interests', campus: 'Campus communities',
};

export default function CommunitiesScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useAuth();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('communities').select('*').order('member_count', { ascending: false });
    if (error) { console.error(error.message); return; }
    setCommunities((data as Community[]) ?? []);
  }, []);

  // Refetches on focus (not just mount) so joining/leaving elsewhere, or
  // changing your interests/university in Edit Profile, is reflected here
  // without needing an app restart — this screen never refreshed at all before.
  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (!hasLoadedOnce) setLoading(true);
        await load();
        setLoading(false);
        setHasLoadedOnce(true);
      })();
    }, [load, hasLoadedOnce])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const userInterests = new Set(profile?.interests ?? []);

  // Both categories are personalized the same way — matched communities move
  // to the top but nothing is ever hidden. Interest matches against the
  // onboarding interest picks; campus matches against the user's own
  // university (set via Edit Profile).
  const matchesUser = (c: Community): boolean => {
    if (c.category === 'interest') return !!c.related_interest && userInterests.has(c.related_interest);
    if (c.category === 'campus') return !!c.related_university && c.related_university === profile?.university;
    return false;
  };

  const sections = (['interest', 'campus'] as CommunityCategory[]).map((cat) => {
    const data = communities.filter((c) => c.category === cat);
    data.sort((a, b) => (matchesUser(b) ? 1 : 0) - (matchesUser(a) ? 1 : 0));
    return { title: SECTION_TITLES[cat], data };
  });

  if (loading) return <View style={styles.centered}><ActivityIndicator color={colors.coral} /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Communities</Text>
      <Text style={styles.sub}>Join groups around your interests or campus.</Text>
      <SectionList
        sections={sections} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
        renderSectionHeader={({ section }) => <Text style={styles.sectionLabel}>{section.title}</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => navigation.navigate('CommunityDetail', { communityId: item.id })}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardMeta}>{item.member_count} members</Text>
            </View>
            {matchesUser(item) && (
              <View style={styles.matchBadge}><Text style={styles.matchBadgeText}>For you</Text></View>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand, paddingTop: 60 },
  centered: { flex: 1, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 26, color: colors.ink, paddingHorizontal: spacing.lg },
  sub: { color: colors.inkSoft, fontSize: 12.5, paddingHorizontal: spacing.lg, marginTop: 4, marginBottom: 8 },
  sectionLabel: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md },
  emoji: { fontSize: 22 },
  cardName: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  cardMeta: { fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  matchBadge: { backgroundColor: colors.tealSoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  matchBadgeText: { fontSize: 10, fontWeight: '700', color: colors.teal },
});
