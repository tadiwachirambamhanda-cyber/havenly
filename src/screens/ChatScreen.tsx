import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';
import type { Message } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'Chat'>;

export default function ChatScreen() {
  const route = useRoute<Route>();
  const { conversationId, otherUserName } = route.params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
    supabase.from('messages').select('*').eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }).then(({ data }) => setMessages((data as Message[]) ?? []));

    const channel = supabase.channel(`chat-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message]))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  const send = async () => {
    if (!input.trim() || !userId) return;
    const body = input.trim();
    setInput('');
    await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: userId, body });
    await supabase.from('conversations').update({ last_message: body, last_message_at: new Date().toISOString() }).eq('id', conversationId);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.headerName}>{otherUserName}</Text></View>
      <FlatList
        ref={listRef} data={messages} keyExtractor={(item) => item.id} contentContainerStyle={{ padding: spacing.lg, gap: 8 }}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.sender_id === userId ? styles.bubbleMe : styles.bubbleThem]}>
            <Text style={item.sender_id === userId ? styles.bubbleTextMe : styles.bubbleTextThem}>{item.body}</Text>
          </View>
        )}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />
      <View style={styles.inputRow}>
        <TextInput style={styles.input} placeholder="Message…" value={input} onChangeText={setInput} onSubmitEditing={send} />
        <Pressable style={styles.sendBtn} onPress={send}><Text style={{ color: colors.sand }}>➤</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  header: { paddingTop: 54, paddingBottom: 12, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderColor: colors.line },
  headerName: { fontSize: 14, fontWeight: '700', color: colors.ink },
  bubble: { maxWidth: '75%', padding: 12, borderRadius: 18 },
  bubbleThem: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignSelf: 'flex-start' },
  bubbleMe: { backgroundColor: colors.coral, alignSelf: 'flex-end' },
  bubbleTextThem: { color: colors.ink, fontSize: 13 },
  bubbleTextMe: { color: 'white', fontSize: 13 },
  inputRow: { flexDirection: 'row', gap: 9, padding: spacing.md, borderTopWidth: 1, borderColor: colors.line, alignItems: 'center' },
  input: { flex: 1, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 11, fontSize: 13 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
