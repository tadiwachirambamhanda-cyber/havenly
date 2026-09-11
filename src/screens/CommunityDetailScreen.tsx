import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Community, WorshipPlace } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'CommunityDetail'>;

export default function CommunityDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { communityId } = route.params;
  const [community, setCommunity] = useState<Community | null>(null);
  const [worshipPlaces, setWorshipPlaces] = useState<WorshipPlace[]>([]);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    supabase.from('communities').select('*').eq('id', communityId).single().then(({ data }) => {
      setCommunity(data as Community);
      if (data?.worship_type) {
        // TODO(claude-code): order by real distance once location permission is granted.
        supabase.from('worship_places').select('*').eq('worship_type', data.worship_type)
          .then(({ data: places }) => setWorshipPlaces((places as WorshipPlace[]) ?? []));
      }
    });

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from('community_members').select('*')
        .eq('community_id', communityId).eq('user_id', user.id).maybeSingle();
      setJoined(!!data);
    });
  }, [communityId]);

  const toggleJoin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (joined) {
      await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', user.id);
    } else {
      await supabase.from('community_members').insert({ community_id: communityId, user_id: user.id });
    }
    setJoined(!joined);
  };

  if (!community) return null;

  return (
    <ScrollView style={styles.container}>
      <Pressable style={styles.back} onPress={() => navigation.goBack()}><Text>←</Text></Pressable>
      <View style={styles.body}>
        <Text style={styles.emoji}>{community.emoji}</Text>
        <Text style={styles.name}>{community.name}</Text>
        <Text style={styles.members}>{community.member_count} members</Text>
        <Text style={styles.desc}>{community.description}</Text>
        <Pressable style={[styles.joinBtn, joined && styles.joinBtnJoined]} onPress={toggleJoin}>
          <Text style={styles.joinBtnText}>{joined ? 'Joined ✓' : 'Join community'}</Text>
        </Pressable>
        {community.worship_type && (
          <View style={{ marginTop: 20 }}>
            <Text style={styles.sectionLabel}>Nearest places of worship</Text>
            {worshipPlaces.map((place) => (
              <View key={place.id} style={styles.worshipCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.worshipName}>{place.name}</Text>
                  <Text style={styles.worshipMeta}>{place.area}</Text>
                </View>
              </View>
            ))}
            {worshipPlaces.length === 0 && <Text style={styles.placeholder}>No places seeded yet for this category.</Text>}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  back: { marginTop: 50, marginLeft: 16, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  body: { padding: spacing.lg },
  emoji: { fontSize: 40 },
  name: { fontFamily: 'Fraunces_600SemiBold', fontSize: 21, color: colors.ink, marginTop: 8 },
  members: { fontSize: 12, color: colors.inkSoft, marginTop: 4 },
  desc: { fontSize: 13, color: '#3A4038', lineHeight: 20, marginTop: 12 },
  joinBtn: { marginTop: 16, backgroundColor: colors.coral, paddingVertical: 13, borderRadius: 100, alignItems: 'center' },
  joinBtnJoined: { backgroundColor: colors.ink },
  joinBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  sectionLabel: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft, marginBottom: 10 },
  worshipCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12, marginBottom: 9 },
  worshipName: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  worshipMeta: { fontSize: 10.5, color: colors.inkSoft, marginTop: 2 },
  placeholder: { color: colors.inkSoft, fontSize: 12 },
});
