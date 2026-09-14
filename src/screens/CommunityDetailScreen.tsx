import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { colors, spacing } from '@/theme/tokens';
import { communityIcon } from '@/constants/topicIcons';
import type { Community } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'CommunityDetail'>;

export default function CommunityDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { communityId } = route.params;
  const { session } = useAuth();
  const [community, setCommunity] = useState<Community | null>(null);
  const [joined, setJoined] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const userId = session?.user.id;

    supabase.from('communities').select('*').eq('id', communityId).single().then(({ data }) => {
      setCommunity(data as Community);
      setLoaded(true);
    });

    if (userId) {
      supabase.from('community_members').select('*')
        .eq('community_id', communityId).eq('user_id', userId).maybeSingle()
        .then(({ data }) => setJoined(!!data));
    }
  }, [communityId, session]);

  const toggleJoin = async () => {
    const userId = session?.user.id;
    if (!userId || !community) return;
    const wasJoined = joined;
    setJoined(!wasJoined);
    setCommunity((prev) => prev && { ...prev, member_count: prev.member_count + (wasJoined ? -1 : 1) });

    const { error } = wasJoined
      ? await supabase.from('community_members').delete().eq('community_id', communityId).eq('user_id', userId)
      : await supabase.from('community_members').insert({ community_id: communityId, user_id: userId });

    if (error) {
      // Revert the optimistic update if the write actually failed.
      setJoined(wasJoined);
      setCommunity((prev) => prev && { ...prev, member_count: prev.member_count + (wasJoined ? 1 : -1) });
    }
  };

  if (!community) {
    return loaded ? (
      <View style={styles.notFound}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}><Feather name="arrow-left" size={17} color={colors.ink} /></Pressable>
        <Text style={styles.notFoundText}>This community isn't available.</Text>
      </View>
    ) : (
      <View style={styles.centered}><ActivityIndicator color={colors.coral} /></View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Pressable style={styles.back} onPress={() => navigation.goBack()}><Feather name="arrow-left" size={17} color={colors.ink} /></Pressable>
      <View style={styles.body}>
        <View style={styles.iconChip}>
          <Feather name={communityIcon(community)} size={28} color={colors.teal} />
        </View>
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
  centered: { flex: 1, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  back: { marginTop: 50, marginLeft: 16, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  notFound: { flex: 1, backgroundColor: colors.sand, paddingTop: 60, paddingHorizontal: spacing.lg },
  notFoundText: { color: colors.inkSoft, textAlign: 'center', marginTop: 100 },
  body: { padding: spacing.lg },
  iconChip: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: 'Fraunces_600SemiBold', fontSize: 21, color: colors.ink, marginTop: 8 },
  members: { fontSize: 12, color: colors.inkSoft, marginTop: 4 },
  desc: { fontSize: 13, color: '#3A4038', lineHeight: 20, marginTop: 12 },
  joinBtn: { marginTop: 16, backgroundColor: colors.coral, paddingVertical: 13, borderRadius: 100, alignItems: 'center' },
  joinBtnJoined: { backgroundColor: colors.ink },
  joinBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
});
