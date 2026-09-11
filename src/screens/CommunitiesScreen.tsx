import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Community, CommunityCategory } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const SECTION_TITLES: Record<CommunityCategory, string> = {
  interest: 'Based on your interests', faith: 'Faith & belief communities', campus: 'Campus communities',
};

export default function CommunitiesScreen() {
  const navigation = useNavigation<Nav>();
  const [communities, setCommunities] = useState<Community[]>([]);

  useEffect(() => {
    supabase.from('communities').select('*').order('member_count', { ascending: false })
      .then(({ data, error }) => {
        if (error) { console.error(error.message); return; }
        setCommunities((data as Community[]) ?? []);
      });
  }, []);

  const sections = (['interest', 'faith', 'campus'] as CommunityCategory[]).map((cat) => ({
    title: SECTION_TITLES[cat], data: communities.filter((c) => c.category === cat),
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Communities</Text>
      <Text style={styles.sub}>Join groups around your interests, faith, or campus.</Text>
      <SectionList
        sections={sections} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingBottom: 40 }}
        renderSectionHeader={({ section }) => <Text style={styles.sectionLabel}>{section.title}</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => navigation.navigate('CommunityDetail', { communityId: item.id })}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardMeta}>{item.member_count} members</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand, paddingTop: 60 },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 26, color: colors.ink, paddingHorizontal: spacing.lg },
  sub: { color: colors.inkSoft, fontSize: 12.5, paddingHorizontal: spacing.lg, marginTop: 4, marginBottom: 8 },
  sectionLabel: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md },
  emoji: { fontSize: 22 },
  cardName: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  cardMeta: { fontSize: 11, color: colors.inkSoft, marginTop: 2 },
});
