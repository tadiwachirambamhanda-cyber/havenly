import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';
import type { Community } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'CommunityDetail'>;

export default function CommunityDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { communityId } = route.params;
  const [community, setCommunity] = useState<Community | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    supabase.from('communities').select('*').eq('id', communityId).single().then(({ data }) => {
      setCommunity(data as Community);
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
});
