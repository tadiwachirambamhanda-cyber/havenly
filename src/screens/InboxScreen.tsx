import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { colors, radius, spacing } from '@/theme/tokens';
import { timeAgo } from '@/utils/timeAgo';
import type { Conversation, Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Row = Conversation & { otherUser: Profile | undefined };

export default function InboxScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const myId = session?.user.id;
    if (!myId) return;

    const { data: conversations } = await supabase.from('conversations').select('*')
      .contains('participant_ids', [myId])
      .neq('status', 'declined')
      .order('last_message_at', { ascending: false, nullsFirst: false });
    if (!conversations) return;

    const otherIds = conversations.map((c) => c.participant_ids.find((id: string) => id !== myId)).filter(Boolean) as string[];
    const { data: profiles } = otherIds.length
      ? await supabase.from('profiles').select('*').in('id', otherIds)
      : { data: [] as Profile[] };
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));

    setRows(conversations.map((c) => ({
      ...(c as Conversation),
      otherUser: profileById.get(c.participant_ids.find((id: string) => id !== myId) ?? ''),
    })));
  }, [session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const myId = session?.user.id;
  const requests = rows.filter((r) => r.status === 'pending' && r.initiator_id !== myId);
  const messages = rows.filter((r) => r.status === 'accepted' || (r.status === 'pending' && r.initiator_id === myId));

  const sections = [
    ...(requests.length ? [{ title: 'Message requests', data: requests }] : []),
    { title: 'Messages', data: messages },
  ];

  const openChat = (row: Row) => {
    if (!row.otherUser) return;
    navigation.navigate('Chat', { conversationId: row.id, otherUserId: row.otherUser.id });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Messages</Text>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchPlaceholder}>Search messages…</Text>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderSectionHeader={({ section }) => (
          sections.length > 1 ? <Text style={styles.sectionLabel}>{section.title}</Text> : null
        )}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => openChat(item)}>
            {item.otherUser?.avatar_url ? (
              <Image source={{ uri: item.otherUser.avatar_url }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={['#0F8B82', '#FF5A3C']} style={styles.avatar} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.otherUser?.display_name ?? 'Havenly user'}</Text>
              <Text style={styles.preview} numberOfLines={1}>
                {item.status === 'pending' && item.initiator_id === myId ? 'Request sent' : item.last_message ?? 'Say hi 👋'}
              </Text>
            </View>
            {item.last_message_at && <Text style={styles.time}>{timeAgo(item.last_message_at)}</Text>}
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.placeholder}>No conversations yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 26, color: colors.ink, paddingHorizontal: spacing.lg, paddingTop: 60 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: spacing.lg, marginTop: 12, marginBottom: 6,
    paddingHorizontal: 16, paddingVertical: 11, backgroundColor: colors.white, borderWidth: 1.5,
    borderColor: colors.line, borderRadius: radius.pill,
  },
  searchIcon: { fontSize: 13 },
  searchPlaceholder: { fontSize: 13, color: colors.inkSoft },
  sectionLabel: {
    fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft,
    fontWeight: '600', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  name: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  preview: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  time: { fontSize: 10.5, color: colors.inkSoft },
  placeholder: { color: colors.inkSoft, paddingHorizontal: spacing.lg, marginTop: 20 },
});
