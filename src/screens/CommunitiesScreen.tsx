import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import { communityIcon } from '@/constants/topicIcons';
import { haptics } from '@/lib/haptics';
import { formatCount } from '@/utils/formatCount';
import Skeleton from '@/components/Skeleton';
import type { Community, CommunityCategory } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const SECTION_TITLES: Record<CommunityCategory, string> = {
  interest: 'Based on your interests', campus: 'Campus communities',
};

export default function CommunitiesScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [showAllCampuses, setShowAllCampuses] = useState(false);
  const [showAllInterests, setShowAllInterests] = useState(false);

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

  const hasUniversity = !!profile?.university;
  const hasInterests = userInterests.size > 0;

  // Once you've set a university, the Campus section defaults to just your
  // own — with 44 campus communities total, seeing every other school's is
  // pure clutter once you can only actually join one of them. "Show all"
  // brings the rest back for anyone who wants to browse. Interests get the
  // same treatment: default to just what you picked, since that list can
  // change any time in Edit Profile and shouldn't force a re-browse of
  // every interest community to find what's still relevant.
  const sections = (['interest', 'campus'] as CommunityCategory[]).map((cat) => {
    let data = communities.filter((c) => c.category === cat);
    if (cat === 'campus' && hasUniversity && !showAllCampuses) {
      data = data.filter((c) => c.related_university === profile?.university);
    }
    if (cat === 'interest' && hasInterests && !showAllInterests) {
      data = data.filter((c) => c.related_interest && userInterests.has(c.related_interest));
    }
    data.sort((a, b) => (matchesUser(b) ? 1 : 0) - (matchesUser(a) ? 1 : 0));
    return { title: SECTION_TITLES[cat], category: cat, data };
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Communities</Text>
        <Text style={styles.sub}>Join groups around your interests or campus.</Text>
        <Skeleton style={{ height: 11, width: 140, marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: 10 }} />
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.card}>
            <Skeleton style={{ width: 40, height: 40, borderRadius: 20 }} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton style={{ height: 13, width: '55%' }} />
              <Skeleton style={{ height: 11, width: '35%' }} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Communities</Text>
      <Text style={styles.sub}>Join groups around your interests or campus.</Text>
      <SectionList
        sections={sections} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>{section.title}</Text>
            {section.category === 'campus' && hasUniversity && (
              <Pressable onPress={() => { haptics.tap(); setShowAllCampuses((v) => !v); }}>
                <Text style={styles.sectionToggle}>{showAllCampuses ? 'Show only mine' : 'Show all'}</Text>
              </Pressable>
            )}
            {section.category === 'interest' && hasInterests && (
              <Pressable onPress={() => { haptics.tap(); setShowAllInterests((v) => !v); }}>
                <Text style={styles.sectionToggle}>{showAllInterests ? 'Show only mine' : 'Show all'}</Text>
              </Pressable>
            )}
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => navigation.navigate('CommunityDetail', { communityId: item.id })}>
            <View style={styles.iconChip}>
              <Feather name={communityIcon(item)} size={16} color={colors.teal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardMeta}>{formatCount(item.member_count)} members</Text>
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

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand, paddingTop: 60 },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 26, color: colors.ink, paddingHorizontal: spacing.lg },
  sub: { color: colors.inkSoft, fontSize: 12.5, paddingHorizontal: spacing.lg, marginTop: 4, marginBottom: 8 },
  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: 10,
  },
  sectionLabel: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft },
  sectionToggle: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 10.5, textTransform: 'uppercase', fontWeight: '700', color: colors.coral },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md },
  iconChip: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  cardMeta: { fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  matchBadge: { backgroundColor: colors.tealSoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  matchBadgeText: { fontSize: 10, fontWeight: '700', color: colors.teal },
  });
}
