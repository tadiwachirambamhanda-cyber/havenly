import React, { useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import InitialsAvatar from '@/components/InitialsAvatar';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { calmDuration, calmEasing } from '@/lib/animations';
import { markConversationRead, uploadGroupIcon } from '@/lib/conversations';
import { blockUser, submitReport } from '@/lib/safety';
import ReportModal from '@/components/ReportModal';
import ActionSheet from '@/components/ActionSheet';
import { radius, spacing, gradients } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import { timeAgo } from '@/utils/timeAgo';
import { groupDisplayName } from '@/utils/groupDisplayName';
import type { Conversation, Message, Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'Chat'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;
// A message that just arrived (sent locally or pushed in via realtime) only
// plays its entrance animation while this timestamp is recent — carried on
// the message itself, not a separate ref, so a row can't be inserted without
// declaring whether it's fresh, and remounting later (scrolling away and
// back) naturally stops replaying it once the timestamp ages out.
type ChatMessage = Message & { _localInsertedAt?: number };
const asFresh = (message: Message): ChatMessage => ({ ...message, _localInsertedAt: Date.now() });

export default function ChatScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { conversationId, otherUserId } = route.params;
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;

  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [blockConfirmVisible, setBlockConfirmVisible] = useState(false);
  const [membersModalVisible, setMembersModalVisible] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [savingIcon, setSavingIcon] = useState(false);
  const listRef = useRef<FlatList>(null);
  const isGroup = conversation?.is_group ?? false;
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const openMembersModal = () => {
    setGroupNameDraft(conversation?.name ?? '');
    setMembersModalVisible(true);
  };

  const saveGroupName = async () => {
    const trimmed = groupNameDraft.trim();
    if (!conversation || trimmed === (conversation.name ?? '')) return;
    const { error } = await supabase.from('conversations').update({ name: trimmed || null }).eq('id', conversationId);
    if (error) { showToast('Couldn’t rename the group. Try again.', 'error'); return; }
    setConversation((prev) => prev && { ...prev, name: trimmed || null });
  };

  const pickGroupIcon = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled) return;
    setSavingIcon(true);
    try {
      const iconUrl = await uploadGroupIcon(conversationId, result.assets[0].uri);
      setConversation((prev) => prev && { ...prev, icon_url: iconUrl });
    } catch {
      showToast('Couldn’t update the group photo. Try again.', 'error');
    } finally {
      setSavingIcon(false);
    }
  };

  useEffect(() => {
    (async () => {
      const { data: conv } = await supabase.from('conversations').select('*').eq('id', conversationId).single();
      setConversation(conv as Conversation | null);
      if (!conv || !myId) return;

      const otherIds = (conv.participant_ids as string[]).filter((id) => id !== myId);
      if (conv.is_group) {
        const { data: memberProfiles } = otherIds.length
          ? await supabase.from('profiles').select('*').in('id', otherIds)
          : { data: [] as Profile[] };
        setMembers((memberProfiles as Profile[]) ?? []);
      } else if (otherIds[0]) {
        const { data } = await supabase.from('profiles').select('*').eq('id', otherIds[0]).single();
        setOtherUser(data as Profile);
      }
    })();

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
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, asFresh(incoming)]));
          if (myId) markConversationRead(conversationId, myId);
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${conversationId}` },
        (payload) => setConversation(payload.new as Conversation))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, myId]);

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
      showToast('Couldn’t send. This conversation may have been closed.', 'error');
      return;
    }
    haptics.confirm();
    setMessages((prev) => (prev.some((m) => m.id === inserted.id) ? prev : [...prev, asFresh(inserted as Message)]));
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
    if (!myId || !otherUserId) return;
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
    if (!myId || !otherUserId) return;
    try {
      await submitReport(myId, 'user', otherUserId, reason);
      showToast('Thanks, we’ve got your report.');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t submit report.', 'error');
    }
  };

  const isInitiator = conversation?.initiator_id === myId;
  const isPending = conversation?.status === 'pending';
  const isDeclined = conversation?.status === 'declined';
  const showAcceptDecline = isPending && !isInitiator;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.header}>
          <BackButton style={styles.back}>
            <Icon name="arrow-left" size={16} color={colors.ink} />
          </BackButton>
          <AnimatedPressable
            style={styles.headerAuthorTap}
            onPress={() => (isGroup ? openMembersModal() : otherUserId && navigation.navigate('UserProfile', { userId: otherUserId }))}
            accessibilityLabel={isGroup ? 'View group info' : `View ${otherUser?.display_name ?? 'their'} profile`}
          >
            {isGroup ? (
              conversation?.icon_url ? (
                <Image source={{ uri: conversation.icon_url }} style={styles.headerAvatar} transition={200} />
              ) : (
                <View style={[styles.headerAvatar, styles.groupAvatar]}>
                  <Icon name="users" size={16} color={colors.teal} />
                </View>
              )
            ) : otherUser?.avatar_url ? (
              <Image source={{ uri: otherUser.avatar_url }} style={styles.headerAvatar} transition={200} />
            ) : (
              <InitialsAvatar name={otherUser?.display_name} style={styles.headerAvatar} />
            )}
            <View>
              <Text style={styles.headerName}>{isGroup ? groupDisplayName(conversation!, members) : otherUser?.display_name ?? '…'}</Text>
              {isGroup && <Text style={styles.headerSub}>{members.length + 1} members</Text>}
            </View>
          </AnimatedPressable>
          <View style={{ flex: 1 }} />
          {!isGroup && (
            <AnimatedPressable style={styles.overflow} onPress={openOptions} accessibilityLabel="More options">
              <Icon name="more-horizontal" size={18} color={colors.ink} />
            </AnimatedPressable>
          )}
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => {
            const mine = item.sender_id === myId;
            const textStyle = mine ? styles.bubbleTextMe : styles.bubbleTextThem;
            const senderName = isGroup && !mine ? memberById.get(item.sender_id)?.display_name : null;
            const isFresh = !!item._localInsertedAt && Date.now() - item._localInsertedAt < 4000;
            return (
              // ItemSeparatorComponent here, not `gap` on the FlatList's
              // contentContainerStyle — gap inside a FlatList content container is
              // unreliable on native (it renders fine on web, which is all that could
              // be checked live here, but was reported as a much bigger gap than 8px
              // on a real device) — and not per-row marginBottom either, since that
              // adds space after the last message too, unlike a real separator.
              <Animated.View entering={isFresh ? FadeInDown.duration(calmDuration).easing(calmEasing) : undefined}>
                {senderName && <Text style={styles.senderName}>{senderName}</Text>}
                <View style={[styles.bubble, mine ? styles.bubbleMe : styles.bubbleThem, item.shared_post && styles.bubbleShared]}>
                  {item.shared_post ? (
                    <AnimatedPressable
                      style={styles.sharedPostRow}
                      onPress={() => navigation.navigate('PostDetail', { postId: item.shared_post!.id })}
                      accessibilityLabel={`Open post: ${item.shared_post.title}`}
                    >
                      {item.shared_post.image_url ? (
                        <Image source={{ uri: item.shared_post.image_url }} style={styles.sharedPostThumb} contentFit="cover" transition={200} />
                      ) : (
                        <LinearGradient colors={gradients[item.shared_post.id.charCodeAt(0) % gradients.length]} style={styles.sharedPostThumb} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sharedPostTag, textStyle]}>{item.shared_post.tag}</Text>
                        <Text style={[styles.sharedPostTitle, textStyle]} numberOfLines={2}>{item.shared_post.title}</Text>
                      </View>
                      <Icon name="chevron-right" size={14} color={mine ? 'rgba(255,255,255,0.8)' : colors.inkSoft} />
                    </AnimatedPressable>
                  ) : (
                    <Text style={textStyle}>{item.body}</Text>
                  )}
                  <Text style={mine ? styles.bubbleTimeMe : styles.bubbleTimeThem}>{timeAgo(item.created_at)}</Text>
                </View>
              </Animated.View>
            );
          }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {showAcceptDecline ? (
          <View style={styles.requestBar}>
            <Text style={styles.requestText}>{otherUser?.display_name ?? 'This person'} wants to message you.</Text>
            <View style={styles.requestActions}>
              <AnimatedPressable style={styles.declineBtn} onPress={() => respondToRequest('declined')} accessibilityLabel="Decline conversation">
                <Text style={styles.declineBtnText}>Decline</Text>
              </AnimatedPressable>
              <AnimatedPressable style={styles.acceptBtn} onPress={() => respondToRequest('accepted')} accessibilityLabel="Accept conversation">
                <Text style={styles.acceptBtnText}>Accept</Text>
              </AnimatedPressable>
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
              <AnimatedPressable style={styles.sendBtn} onPress={send} accessibilityLabel="Send message">
                <Icon name="send" size={15} color={colors.sand} />
              </AnimatedPressable>
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
      <Modal visible={membersModalVisible} transparent animationType="fade" onRequestClose={() => setMembersModalVisible(false)}>
        <AnimatedPressable style={styles.membersBackdrop} onPress={() => setMembersModalVisible(false)}>
          <AnimatedPressable style={[styles.membersCard, { paddingBottom: insets.bottom + spacing.md }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.membersHandle} />
            <AnimatedPressable style={styles.groupIconEdit} onPress={pickGroupIcon} accessibilityLabel="Change group photo">
              {conversation?.icon_url ? (
                <Image source={{ uri: conversation.icon_url }} style={styles.groupIconEditImg} transition={200} />
              ) : (
                <View style={[styles.groupIconEditImg, styles.groupAvatar]}>
                  <Icon name="users" size={22} color={colors.teal} />
                </View>
              )}
              <View style={styles.groupIconEditBadge}>
                {savingIcon ? <Icon name="loader" size={11} color="white" /> : <Icon name="camera" size={11} color="white" />}
              </View>
            </AnimatedPressable>
            <View style={styles.groupNameRow}>
              <TextInput
                style={styles.groupNameInput}
                placeholder="Name this group…"
                placeholderTextColor={colors.inkSoft}
                value={groupNameDraft}
                onChangeText={setGroupNameDraft}
                onBlur={saveGroupName}
                onSubmitEditing={saveGroupName}
              />
            </View>
            <Text style={styles.membersSubtitle}>{members.length + 1} members</Text>
            <FlatList
              data={members}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingTop: spacing.md }}
              renderItem={({ item }) => (
                <AnimatedPressable
                  style={styles.memberRow}
                  onPress={() => { setMembersModalVisible(false); navigation.navigate('UserProfile', { userId: item.id }); }}
                  accessibilityLabel={`View ${item.display_name}'s profile`}
                >
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.memberAvatar} transition={200} />
                  ) : (
                    <InitialsAvatar name={item.display_name} style={styles.memberAvatar} />
                  )}
                  <View>
                    <Text style={styles.memberName}>{item.display_name}</Text>
                    <Text style={styles.memberHandle}>@{item.username}</Text>
                  </View>
                </AnimatedPressable>
              )}
            />
          </AnimatedPressable>
        </AnimatedPressable>
      </Modal>
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
  groupAvatar: { backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  headerSub: { fontSize: 10.5, color: colors.inkSoft, marginTop: 1 },
  senderName: { fontSize: 10.5, fontWeight: '700', color: colors.inkSoft, marginBottom: 3, marginLeft: 4 },
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
  input: { flex: 1, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.button, paddingHorizontal: 16, paddingVertical: 11, fontSize: 13, color: colors.ink },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  requestBar: { padding: spacing.lg, borderTopWidth: 1, borderColor: colors.line, alignItems: 'center' },
  requestText: { fontSize: 12.5, color: colors.inkSoft, marginBottom: 12, textAlign: 'center' },
  requestActions: { flexDirection: 'row', gap: 10 },
  declineBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.button, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  declineBtnText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  acceptBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.button, backgroundColor: colors.coral },
  acceptBtnText: { fontSize: 13, fontWeight: '700', color: 'white' },
  membersBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  membersCard: {
    backgroundColor: colors.sand, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    padding: spacing.lg, maxHeight: '70%',
  },
  membersHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 14 },
  groupIconEdit: { alignSelf: 'center' },
  groupIconEditImg: { width: 64, height: 64, borderRadius: 32 },
  groupIconEditBadge: {
    position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.ink, borderWidth: 2, borderColor: colors.sand, alignItems: 'center', justifyContent: 'center',
  },
  groupNameRow: { marginTop: 10 },
  groupNameInput: { fontFamily: 'Fraunces_600SemiBold', fontSize: 17, color: colors.ink, textAlign: 'center', padding: 0 },
  membersSubtitle: { fontSize: 12, color: colors.inkSoft, marginTop: 2, textAlign: 'center' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  memberAvatar: { width: 42, height: 42, borderRadius: 21 },
  memberName: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  memberHandle: { fontSize: 11, color: colors.inkSoft, fontFamily: 'JetBrainsMono_500Medium', marginTop: 1 },
  });
}
