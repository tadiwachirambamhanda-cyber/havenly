import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { colors, radius, spacing } from '@/theme/tokens';
import { timeAgo } from '@/utils/timeAgo';
import type { Conversation, Message, Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'Chat'>;

export default function ChatScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { conversationId, otherUserId } = route.params;
  const { session } = useAuth();
  const myId = session?.user.id;

  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', otherUserId).single()
      .then(({ data }) => setOtherUser(data as Profile));
    supabase.from('conversations').select('*').eq('id', conversationId).single()
      .then(({ data }) => setConversation(data as Conversation));
    supabase.from('messages').select('*').eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }).then(({ data }) => setMessages((data as Message[]) ?? []));

    const channel = supabase.channel(`chat-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${conversationId}` },
        (payload) => setConversation(payload.new as Conversation))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, otherUserId]);

  const send = async () => {
    if (!input.trim() || !myId) return;
    const body = input.trim();
    setInput('');
    await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: myId, body });
    await supabase.from('conversations').update({ last_message: body, last_message_at: new Date().toISOString() }).eq('id', conversationId);
  };

  const respondToRequest = async (status: 'accepted' | 'declined') => {
    await supabase.from('conversations').update({ status }).eq('id', conversationId);
    setConversation((prev) => prev && { ...prev, status });
    if (status === 'declined') navigation.goBack();
  };

  const isInitiator = conversation?.initiator_id === myId;
  const isPending = conversation?.status === 'pending';
  const isDeclined = conversation?.status === 'declined';
  const showAcceptDecline = isPending && !isInitiator;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => navigation.goBack()}><Text>←</Text></Pressable>
          {otherUser?.avatar_url ? (
            <Image source={{ uri: otherUser.avatar_url }} style={styles.headerAvatar} />
          ) : (
            <LinearGradient colors={['#0F8B82', '#FF5A3C']} style={styles.headerAvatar} />
          )}
          <Text style={styles.headerName}>{otherUser?.display_name ?? '…'}</Text>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, gap: 8 }}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.sender_id === myId ? styles.bubbleMe : styles.bubbleThem]}>
              <Text style={item.sender_id === myId ? styles.bubbleTextMe : styles.bubbleTextThem}>{item.body}</Text>
              <Text style={item.sender_id === myId ? styles.bubbleTimeMe : styles.bubbleTimeThem}>{timeAgo(item.created_at)}</Text>
            </View>
          )}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {showAcceptDecline ? (
          <View style={styles.requestBar}>
            <Text style={styles.requestText}>{otherUser?.display_name ?? 'This person'} wants to message you.</Text>
            <View style={styles.requestActions}>
              <Pressable style={styles.declineBtn} onPress={() => respondToRequest('declined')}>
                <Text style={styles.declineBtnText}>Decline</Text>
              </Pressable>
              <Pressable style={styles.acceptBtn} onPress={() => respondToRequest('accepted')}>
                <Text style={styles.acceptBtnText}>Accept</Text>
              </Pressable>
            </View>
          </View>
        ) : isDeclined ? (
          <View style={styles.requestBar}><Text style={styles.requestText}>This conversation was declined.</Text></View>
        ) : (
          <View style={styles.inputRow}>
            {isPending && isInitiator && <Text style={styles.pendingHint}>Waiting for {otherUser?.display_name ?? 'them'} to accept your request</Text>}
            <View style={styles.inputInner}>
              <TextInput style={styles.input} placeholder="Message…" value={input} onChangeText={setInput} onSubmitEditing={send} />
              <Pressable style={styles.sendBtn} onPress={send}><Text style={{ color: colors.sand }}>➤</Text></Pressable>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 54, paddingBottom: 12,
    paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderColor: colors.line,
  },
  back: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 34, height: 34, borderRadius: 17 },
  headerName: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  bubble: { maxWidth: '75%', padding: 12, borderRadius: 18 },
  bubbleThem: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignSelf: 'flex-start' },
  bubbleMe: { backgroundColor: colors.coral, alignSelf: 'flex-end' },
  bubbleTextThem: { color: colors.ink, fontSize: 13 },
  bubbleTextMe: { color: 'white', fontSize: 13 },
  bubbleTimeThem: { color: colors.inkSoft, fontSize: 9.5, marginTop: 3 },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.75)', fontSize: 9.5, marginTop: 3 },
  inputRow: { padding: spacing.md, borderTopWidth: 1, borderColor: colors.line },
  inputInner: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  pendingHint: { fontSize: 11, color: colors.inkSoft, marginBottom: 8, textAlign: 'center' },
  input: { flex: 1, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 11, fontSize: 13 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  requestBar: { padding: spacing.lg, borderTopWidth: 1, borderColor: colors.line, alignItems: 'center' },
  requestText: { fontSize: 12.5, color: colors.inkSoft, marginBottom: 12, textAlign: 'center' },
  requestActions: { flexDirection: 'row', gap: 10 },
  declineBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  declineBtnText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  acceptBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.coral },
  acceptBtnText: { fontSize: 13, fontWeight: '700', color: 'white' },
});
