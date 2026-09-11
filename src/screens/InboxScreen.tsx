import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';
import type { Conversation } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function InboxScreen() {
  const navigation = useNavigation<Nav>();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from('conversations').select('*')
        .contains('participant_ids', [user.id]).order('last_message_at', { ascending: false });
      setConversations((data as Conversation[]) ?? []);
    });
    // TODO(claude-code): subscribe to realtime updates on `messages` so new
    // DMs bump the conversation to the top without a manual refresh.
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Messages</Text>
      <FlatList
        data={conversations} keyExtractor={(item) => item.id} contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => navigation.navigate('Chat', { conversationId: item.id, otherUserName: 'User' })}>
            <View style={styles.avatar} />
            <View style={{ flex: 1 }}><Text style={styles.preview} numberOfLines={1}>{item.last_message ?? 'Say hi 👋'}</Text></View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={styles.placeholder}>No conversations yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand, paddingTop: 60 },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 26, color: colors.ink, paddingHorizontal: spacing.lg, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.coralSoft },
  preview: { fontSize: 13, color: colors.ink },
  placeholder: { color: colors.inkSoft, paddingHorizontal: spacing.lg, marginTop: 20 },
});
