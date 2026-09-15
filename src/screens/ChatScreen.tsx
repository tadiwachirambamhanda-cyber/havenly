import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { markConversationRead } from '@/lib/conversations';
import { blockUser, submitReport } from '@/lib/safety';
import ReportModal from '@/components/ReportModal';
import ActionSheet from '@/components/ActionSheet';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import { timeAgo } from '@/utils/timeAgo';
import type { Conversation, Message, Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'Chat'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function ChatScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { conversationId, otherUserId } = route.params;
  const { session } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;

  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [blockConfirmVisible, setBlockConfirmVisible] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', otherUserId).single()
      .then(({ data }) => setOtherUser(data as Profile));
    supabase.from('conversations').select('*').eq('id', conversationId).single()
      .then(({ data }) => setConversation(data as Conversation));
    supabase.from('messages').select('*, shared_post:posts(id, title, tag, image_url, video_url)').eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }).then(({ data }) => setMessages((data as unknown as Message[]) ?? []));

    if (myId) markConversationRead(conversationId, myId);

    // Dedupe by id in both handlers below: a message I send is appended
    // immediately in `send()` for instant feedback, then arrives again here
    // via realtime — without the check it would render twice.
    const channel = supabase.channel(`chat-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const incoming = payload.new as Message;
          // Realtime payloads carry only the raw row — no joins — so a
          // shared post needs its own fetch to render as a preview card.
          if (incoming.shared_post_id) {
            const { data: sharedPost } = await supabase.from('posts')
              .select('id, title, tag, image_url, video_url').eq('id', incoming.shared_post_id).maybeSingle();
            incoming.shared_post = sharedPost as Message['shared_post'];
          }
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          if (myId) markConversationRead(conversationId, myId);
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${conversationId}` },
        (payload) => setConversation(payload.new as Conversation))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, otherUserId, myId]);

  const send = async () => {
    if (!input.trim() || !myId) return;
    const body = input.trim();
    setInput('');
    const { data: inserted, error } = await supabase.from('messages')
      .insert({ conversation_id: conversationId, sender_id: myId, body })
      .select().single();
    if (error) {
      console.error('Failed to send message:', error.message);
      setInput(body);
      showToast('Couldn’t send — this conversation may no longer be available.', 'error');
      return;
    }
    haptics.confirm();
    setMessages((prev) => (prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted as Message]));
    await supabase.from('conversations').update({ last_message: body, last_message_at: new Date().toISOString() }).eq('id', conversationId);
    await markConversationRead(conversationId, myId);
  };

  const respondToRequest = async (status: 'accepted' | 'declined') => {
    haptics.tap();
    await supabase.from('conversations').update({ status }).eq('id', conversationId);
    setConversation((prev) => prev && { ...prev, status });
    if (status === 'declined') navigation.goBack();
  };

  const handleBlock = () => setBlockConfirmVisible(true);

  const confirmBlock = async () => {
    if (!myId) return;
    try {
      await blockUser(myId, otherUserId);
      haptics.success();
      navigation.goBack();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t block. Try again.', 'error');
    }
  };

  const openOptions = () => setOptionsVisible(true);

  const handleReportSubmit = async (reason: string) => {
    setReportModalVisible(false);
    if (!myId) return;
    try {
      await submitReport(myId, 'user', otherUserId, reason);
      showToast('Thanks — we’ve got your report.');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t submit report.', 'error');
    }
  };

  const isInitiator = conversation?.initiator_id === myId;
  const isPending = conversation?.status === 'pending';
  const isDeclined = conversation?.status === 'declined';
  const showAcceptDecline = isPending && !isInitiator;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
            <Feather name="arrow-left" size={16} color={colors.ink} />
          </Pressable>
          <Pressable
            style={styles.headerAuthorTap}
            onPress={() => navigation.navigate('UserProfile', { userId: otherUserId })}
            accessibilityLabel={`View ${otherUser?.display_name ?? 'their'} profile`}
          >
            {otherUser?.avatar_url ? (
              <Image source={{ uri: otherUser.avatar_url }} style={styles.headerAvatar} transition={200} />
            ) : (
              <LinearGradient colors={['#0F8B82', '#FF5A3C']} style={styles.headerAvatar} />
            )}
            <Text style={styles.headerName}>{otherUser?.display_name ?? '…'}</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable style={styles.overflow} onPress={openOptions} accessibilityLabel="More options">
            <Feather name="more-horizontal" size={18} color={colors.ink} />
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, gap: 8 }}
          renderItem={({ item }) => {
            const mine = item.sender_id === myId;
            const textStyle = mine ? styles.bubbleTextMe : styles.bubbleTextThem;
            return (
              <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleThem, item.shared_post && styles.bubbleShared]}>
                {item.shared_post ? (
                  <Pressable
                    style={styles.sharedPostRow}
                    onPress={() => navigation.navigate('PostDetail', { postId: item.shared_post!.id })}
                    accessibilityLabel={`Open post: ${item.shared_post.title}`}
                  >
                    {item.shared_post.image_url ? (
                      <Image source={{ uri: item.shared_post.image_url }} style={styles.sharedPostThumb} contentFit="cover" transition={200} />
                    ) : (
                      <LinearGradient colors={['#0F8B82', '#FF5A3C']} style={styles.sharedPostThumb} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sharedPostTag, textStyle]}>{item.shared_post.tag}</Text>
                      <Text style={[styles.sharedPostTitle, textStyle]} numberOfLines={2}>{item.shared_post.title}</Text>
                    </View>
                    <Feather name="chevron-right" size={14} color={mine ? 'rgba(255,255,255,0.8)' : colors.inkSoft} />
                  </Pressable>
                ) : (
                  <Text style={textStyle}>{item.body}</Text>
                )}
                <Text style={mine ? styles.bubbleTimeMe : styles.bubbleTimeThem}>{timeAgo(item.created_at)}</Text>
              </View>
            );
          }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {showAcceptDecline ? (
          <View style={styles.requestBar}>
            <Text style={styles.requestText}>{otherUser?.display_name ?? 'This person'} wants to message you.</Text>
            <View style={styles.requestActions}>
              <Pressable style={styles.declineBtn} onPress={() => respondToRequest('declined')} accessibilityLabel="Decline conversation">
                <Text style={styles.declineBtnText}>Decline</Text>
              </Pressable>
              <Pressable style={styles.acceptBtn} onPress={() => respondToRequest('accepted')} accessibilityLabel="Accept conversation">
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
              <TextInput
                style={styles.input}
                placeholder="Message…"
                placeholderTextColor={colors.inkSoft}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={send}
              />
              <Pressable style={styles.sendBtn} onPress={send} accessibilityLabel="Send message">
                <Feather name="send" size={15} color={colors.sand} />
              </Pressable>
            </View>
          </View>
        )}
      </View>
      <ReportModal visible={reportModalVisible} onClose={() => setReportModalVisible(false)} onSubmit={handleReportSubmit} />
      <ActionSheet
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        actions={[
          { label: 'Report user', onPress: () => setReportModalVisible(true) },
          { label: `Block @${otherUser?.username ?? 'user'}`, destructive: true, onPress: handleBlock },
        ]}
      />
      <ActionSheet
        visible={blockConfirmVisible}
        onClose={() => setBlockConfirmVisible(false)}
        title={`Block @${otherUser?.username ?? 'this user'}?`}
        message="They won't be able to message you or see each other's posts anymore."
        actions={[{ label: 'Block', destructive: true, onPress: confirmBlock }]}
      />
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 54, paddingBottom: 12,
    paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderColor: colors.line,
  },
  back: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  overflow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerAuthorTap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 34, height: 34, borderRadius: 17 },
  headerName: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  bubble: { maxWidth: '75%', padding: 12, borderRadius: 18 },
  bubbleThem: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignSelf: 'flex-start' },
  bubbleMe: { backgroundColor: colors.coral, alignSelf: 'flex-end' },
  bubbleTextThem: { color: colors.ink, fontSize: 13 },
  bubbleTextMe: { color: 'white', fontSize: 13 },
  bubbleTimeThem: { color: colors.inkSoft, fontSize: 9.5, marginTop: 3 },
  bubbleTimeMe: { color: 'rgba(255,255,255,0.75)', fontSize: 9.5, marginTop: 3 },
  bubbleShared: { padding: 8 },
  sharedPostRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 190 },
  sharedPostThumb: { width: 46, height: 46, borderRadius: 10 },
  sharedPostTag: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 9, textTransform: 'uppercase', opacity: 0.7 },
  sharedPostTitle: { fontSize: 12.5, fontWeight: '700', marginTop: 2, lineHeight: 16 },
  inputRow: { padding: spacing.md, borderTopWidth: 1, borderColor: colors.line },
  inputInner: { flexDirection: 'row', gap: 9, alignItems: 'center' },
  pendingHint: { fontSize: 11, color: colors.inkSoft, marginBottom: 8, textAlign: 'center' },
  input: { flex: 1, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 11, fontSize: 13, color: colors.ink },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  requestBar: { padding: spacing.lg, borderTopWidth: 1, borderColor: colors.line, alignItems: 'center' },
  requestText: { fontSize: 12.5, color: colors.inkSoft, marginBottom: 12, textAlign: 'center' },
  requestActions: { flexDirection: 'row', gap: 10 },
  declineBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  declineBtnText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  acceptBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.coral },
  acceptBtnText: { fontSize: 13, fontWeight: '700', color: 'white' },
  });
}
