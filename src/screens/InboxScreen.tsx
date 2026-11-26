import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, SectionList, RefreshControl } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import AnimatedPressable from '@/components/AnimatedPressable';
import Animated from 'react-native-reanimated';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import InitialsAvatar from '@/components/InitialsAvatar';
import Icon from '@/components/Icon';
import ScreenHeader, { CARD_RADIUS_V2 } from '@/components/ScreenHeader';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import EmptyState from '@/components/EmptyState';
import PersonRowSkeleton from '@/components/PersonRowSkeleton';
import SwipeToAction from '@/components/SwipeToAction';
import { hideConversation } from '@/lib/conversations';
import { haptics } from '@/lib/haptics';
import { timeAgo } from '@/utils/timeAgo';
import { groupDisplayName } from '@/utils/groupDisplayName';
import type { Conversation, Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
// otherUser stays around for 1:1 rows (existing rendering/openChat logic);
// members holds every other participant, populated for both shapes so
// group rows have something to build a display name and avatar from.
type Row = Conversation & { otherUser: Profile | undefined; members: Profile[]; unread: boolean };

export default function InboxScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rows, setRows] = useState<Row[]>([]);
  // Until the first load finishes, show placeholder rows rather than the
  // "No conversations yet" empty state flashing up for someone who has some.
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const myId = session?.user.id;
  // Every conversation id this user is part of (not just the visible ones) —
  // lets the realtime subscription below skip load() for events on
  // conversations that aren't this user's, instead of reloading on every
  // message/conversation change anywhere in the app.
  const myConversationIdsRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!myId) return;

    const [{ data: conversations }, { data: reads }, { data: hidden }] = await Promise.all([
      supabase.from('conversations').select('*')
        .contains('participant_ids', [myId])
        .neq('status', 'declined')
        .order('last_message_at', { ascending: false, nullsFirst: false }),
      supabase.from('conversation_reads').select('conversation_id, last_read_at').eq('user_id', myId),
      supabase.from('conversation_hidden_for').select('conversation_id, hidden_at').eq('user_id', myId),
    ]);
    if (!conversations) { setLoaded(true); return; }
    myConversationIdsRef.current = new Set(conversations.map((c) => c.id));

    const readAtByConversation = new Map((reads ?? []).map((r) => [r.conversation_id, r.last_read_at]));
    // A conversation stays hidden only while nothing's happened in it since
    // the hide — the moment a new message lands, last_message_at moves past
    // hidden_at and it reappears on its own, same as WhatsApp/iMessage.
    const hiddenAtByConversation = new Map((hidden ?? []).map((h) => [h.conversation_id, h.hidden_at]));
    const visibleConversations = conversations.filter((c) => {
      const hiddenAt = hiddenAtByConversation.get(c.id);
      if (!hiddenAt) return true;
      return !!c.last_message_at && new Date(c.last_message_at) > new Date(hiddenAt);
    });

    // All other participants across every conversation, not just "the"
    // other person — a group needs every member, not one.
    const otherIds = Array.from(new Set(
      visibleConversations.flatMap((c) => c.participant_ids.filter((id: string) => id !== myId))
    ));
    const { data: profiles } = otherIds.length
      ? await supabase.from('profiles').select('*').in('id', otherIds)
      : { data: [] as Profile[] };
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));

    setRows(visibleConversations.map((c) => {
      const readAt = readAtByConversation.get(c.id);
      const unread = !!c.last_message_at && (!readAt || new Date(readAt) < new Date(c.last_message_at));
      const members = (c.participant_ids as string[])
        .filter((id) => id !== myId)
        .map((id) => profileById.get(id))
        .filter((p): p is Profile => !!p);
      return { ...(c as Conversation), otherUser: members[0], members, unread };
    }));
    setLoaded(true);
  }, [myId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Keep the list live while sitting on this tab, not just on re-focus —
  // both a new message and someone else's read state changing (irrelevant
  // here, but conversations status/last_message updates matter) should
  // update the list without the user needing to switch tabs and back.
  useEffect(() => {
    if (!myId) return;
    const channel = supabase.channel('inbox-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as { conversation_id?: string };
        if (row.conversation_id && myConversationIdsRef.current.has(row.conversation_id)) load();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, (payload) => {
        const row = payload.new as { id?: string };
        if (row.id && myConversationIdsRef.current.has(row.id)) load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myId, load]);

  const trimmed = query.trim().toLowerCase();
  const filteredRows = trimmed
    ? rows.filter((r) =>
        (r.is_group
          ? groupDisplayName(r, r.members).toLowerCase().includes(trimmed)
          : r.otherUser?.display_name.toLowerCase().includes(trimmed) || r.otherUser?.username.toLowerCase().includes(trimmed)))
    : rows;

  const requests = filteredRows.filter((r) => r.status === 'pending' && r.initiator_id !== myId);
  const messages = filteredRows.filter((r) => r.status === 'accepted' || (r.status === 'pending' && r.initiator_id === myId));

  const sections = [
    ...(requests.length ? [{ title: 'Message requests', data: requests }] : []),
    { title: 'Messages', data: messages },
  ];

  const openChat = (row: Row) => {
    if (!row.is_group && !row.otherUser) return;
    navigation.navigate('Chat', { conversationId: row.id, otherUserId: row.otherUser?.id });
  };

  // Removed from just this device's list, not deleted for the other
  // participant(s). Optimistic, but rolled back with a toast if the write
  // actually fails rather than leaving the user unsure whether it worked.
  const handleDelete = async (row: Row) => {
    if (!myId) return;
    haptics.tap();
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    try {
      await hideConversation(row.id, myId);
    } catch {
      setRows((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]));
      showToast("Couldn't delete that conversation. Try again.", 'error');
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Messages" />
      <View style={styles.searchBar}>
        <Icon name="search" size={18} color={colors.inkSoft} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages…"
          placeholderTextColor={colors.inkSoft}
          value={query}
          onChangeText={setQuery}
        />
        {trimmed.length > 0 && (
          <AnimatedPressable style={styles.clearBtn} onPress={() => setQuery('')} accessibilityLabel="Clear search">
            <Icon name="x" size={14} color={colors.inkSoft} />
          </AnimatedPressable>
        )}
      </View>
      {!loaded ? (
        <PersonRowSkeleton count={7} />
      ) : requests.length === 0 && messages.length === 0 ? (
        <EmptyState
          icon={trimmed ? 'search' : 'mail'}
          text={trimmed ? `No conversations matching "${query.trim()}"` : 'No conversations yet.'}
        />
      ) : (
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
        renderSectionHeader={({ section }) => (
          sections.length > 1 ? <Text style={styles.sectionLabel}>{section.title}</Text> : null
        )}
        renderItem={({ item, index }) => (
          <Animated.View>
          <SwipeToAction actionLabel="Delete" onAction={() => handleDelete(item)}>
          <AnimatedPressable style={styles.row} onPress={() => openChat(item)}>
            <View>
              {item.is_group ? (
                item.icon_url ? (
                  <Image source={{ uri: item.icon_url }} style={styles.avatar} transition={200} />
                ) : (
                  <View style={[styles.avatar, styles.groupAvatar]}>
                    <Icon name="users" size={20} color={colors.coral} />
                  </View>
                )
              ) : item.otherUser?.avatar_url ? (
                <Image source={{ uri: item.otherUser.avatar_url }} style={styles.avatar} transition={200} />
              ) : (
                <InitialsAvatar name={item.otherUser?.display_name} style={styles.avatar} />
              )}
              {item.unread && <View style={styles.unreadDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.is_group ? groupDisplayName(item, item.members) : item.otherUser?.display_name ?? 'Havenly user'}</Text>
              <Text style={[styles.preview, item.unread && styles.previewUnread]} numberOfLines={1}>
                {item.status === 'pending' && item.initiator_id === myId ? 'Request sent' : item.last_message ?? 'Say hi'}
              </Text>
            </View>
            {item.last_message_at && <Text style={styles.time}>{timeAgo(item.last_message_at)}</Text>}
          </AnimatedPressable>
          </SwipeToAction>
          </Animated.View>
        )}
      />
      )}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  groupAvatar: { backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: spacing.lg, marginBottom: 6,
    paddingHorizontal: 16, minHeight: 52, backgroundColor: colors.white, borderWidth: 1,
    borderColor: colors.fieldLine, borderRadius: 26,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.ink, paddingVertical: 12 },
  clearBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: {
    fontFamily: 'HankenGrotesk_700Bold', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.inkSoft, paddingTop: 18, paddingBottom: 10,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8,
    backgroundColor: colors.white, borderRadius: CARD_RADIUS_V2, borderWidth: 1, borderColor: colors.line,
  },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  unreadDot: { position: 'absolute', top: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.coralFill, borderWidth: 2, borderColor: colors.white },
  name: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 15, color: colors.ink },
  preview: { fontSize: 14, color: colors.inkSoft, marginTop: 2 },
  previewUnread: { color: colors.ink, fontFamily: 'HankenGrotesk_600SemiBold' },
  time: { fontSize: 12, color: colors.inkSoft },
  });
}
