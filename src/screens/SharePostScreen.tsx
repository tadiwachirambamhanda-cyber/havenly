import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, TextInput, ActivityIndicator } from 'react-native';
import AnimatedPressable from '@/components/AnimatedPressable';
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
import { findOrCreateConversation } from '@/lib/conversations';
import { groupDisplayName } from '@/utils/groupDisplayName';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import EmptyState from '@/components/EmptyState';
import PersonRowSkeleton from '@/components/PersonRowSkeleton';
import type { Conversation, Post, Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'SharePost'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

// A send target is either a specific person (send goes through
// findOrCreateConversation) or a group already has a conversation id to
// send straight into. Both reduce to the same row shape for rendering.
type Target =
  | { kind: 'person'; id: string; conversationId?: undefined; name: string; subtitle: string; imageUrl: string | null }
  | { kind: 'group'; id: string; conversationId: string; name: string; subtitle: string; imageUrl: string | null };

export default function SharePostScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { postId } = route.params;
  const { session } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;

  const [post, setPost] = useState<Post | null>(null);
  const [people, setPeople] = useState<Target[]>([]);
  const [groups, setGroups] = useState<Target[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!myId) return;
    (async () => {
      // Following, not followers — the people you'd plausibly want to send
      // something to, not everyone who happens to follow you.
      const [{ data: postData }, { data: followRows }, { data: blockedRows }, { data: groupRows }] = await Promise.all([
        supabase.from('posts').select('*').eq('id', postId).maybeSingle(),
        supabase.from('follows').select('profile:profiles!follows_following_id_fkey(*)').eq('follower_id', myId),
        supabase.from('blocked_users').select('blocked_id').eq('blocker_id', myId),
        supabase.from('conversations').select('*').eq('is_group', true).contains('participant_ids', [myId]),
      ]);
      setPost(postData as Post);

      const blockedIds = new Set((blockedRows ?? []).map((b) => b.blocked_id));
      const followProfiles = ((followRows ?? []) as unknown as { profile: Profile }[])
        .map((r) => r.profile)
        .filter((p) => p && !blockedIds.has(p.id));
      setPeople(followProfiles.map((p) => ({
        kind: 'person', id: p.id, name: p.display_name, subtitle: `@${p.username}`, imageUrl: p.avatar_url,
      })));

      const groupConversations = (groupRows ?? []) as Conversation[];
      const allMemberIds = Array.from(new Set(groupConversations.flatMap((g) => g.participant_ids.filter((id) => id !== myId))));
      const { data: memberProfiles } = allMemberIds.length
        ? await supabase.from('profiles').select('*').in('id', allMemberIds)
        : { data: [] as Profile[] };
      const profileById = new Map((memberProfiles ?? []).map((p) => [p.id, p as Profile]));
      setGroups(groupConversations.map((g) => {
        const members = g.participant_ids.filter((id) => id !== myId).map((id) => profileById.get(id)).filter((p): p is Profile => !!p);
        return {
          kind: 'group', id: g.id, conversationId: g.id, name: groupDisplayName(g, members),
          subtitle: `${members.length + 1} members`, imageUrl: g.icon_url,
        };
      }));

      setLoaded(true);
    })();
  }, [postId, myId]);

  const trimmed = query.trim().toLowerCase();
  const filteredPeople = trimmed ? people.filter((p) => p.name.toLowerCase().includes(trimmed) || p.subtitle.toLowerCase().includes(trimmed)) : people;
  const filteredGroups = trimmed ? groups.filter((g) => g.name.toLowerCase().includes(trimmed)) : groups;

  const sections = [
    ...(filteredGroups.length ? [{ title: 'Groups', data: filteredGroups }] : []),
    ...(filteredPeople.length ? [{ title: 'Following', data: filteredPeople }] : []),
  ];

  const sendTo = async (target: Target) => {
    if (!myId || !post || sentIds.has(target.id)) return;
    setSendingId(target.id);
    try {
      const conversationId = target.kind === 'group' ? target.conversationId : await findOrCreateConversation(myId, target.id);
      const { error } = await supabase.from('messages')
        .insert({ conversation_id: conversationId, sender_id: myId, body: post.title, shared_post_id: post.id });
      if (error) throw error;
      await supabase.from('conversations')
        .update({ last_message: `📎 Shared: ${post.title}`, last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
      haptics.confirm();
      setSentIds((prev) => new Set(prev).add(target.id));
    } catch {
      showToast('Couldn’t send — try again.', 'error');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AnimatedPressable style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back" hitSlop={8}>
          <Feather name="arrow-left" size={17} color={colors.ink} />
        </AnimatedPressable>
        <Text style={styles.title}>Send to</Text>
      </View>
      <View style={styles.searchBar}>
        <Feather name="search" size={14} color={colors.inkSoft} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search people or groups…"
          placeholderTextColor={colors.inkSoft}
          value={query}
          onChangeText={setQuery}
        />
      </View>
      {!loaded ? (
        <PersonRowSkeleton />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 4, flexGrow: 1 }}
          renderSectionHeader={({ section }) => (
            sections.length > 1 ? <Text style={styles.sectionLabel}>{section.title}</Text> : null
          )}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              text={people.length === 0 && groups.length === 0 ? 'You’re not following anyone or in a group yet.' : `No matches for "${query.trim()}"`}
            />
          }
          renderItem={({ item }) => {
            const sent = sentIds.has(item.id);
            return (
              <View style={styles.row}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.avatar} transition={200} />
                ) : item.kind === 'group' ? (
                  <View style={[styles.avatar, styles.groupAvatar]}>
                    <Feather name="users" size={18} color={colors.teal} />
                  </View>
                ) : (
                  <LinearGradient colors={['#0F8B82', '#FF5A3C']} style={styles.avatar} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.handle}>{item.subtitle}</Text>
                </View>
                <AnimatedPressable
                  style={[styles.sendBtn, sent && styles.sendBtnSent]}
                  onPress={() => sendTo(item)}
                  disabled={sent || sendingId === item.id}
                  accessibilityLabel={sent ? `Sent to ${item.name}` : `Send to ${item.name}`}
                >
                  {sendingId === item.id ? (
                    <ActivityIndicator size="small" color={colors.ink} />
                  ) : (
                    <Text style={[styles.sendBtnText, sent && styles.sendBtnTextSent]}>{sent ? 'Sent ✓' : 'Send'}</Text>
                  )}
                </AnimatedPressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 54, paddingBottom: 16, paddingHorizontal: spacing.lg },
  back: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 19, color: colors.ink },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: spacing.lg, marginBottom: 6,
    paddingHorizontal: 16, paddingVertical: 11, backgroundColor: colors.white, borderWidth: 1.5,
    borderColor: colors.line, borderRadius: radius.pill,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.ink },
  sectionLabel: {
    fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft,
    fontWeight: '600', paddingTop: spacing.md, paddingBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  groupAvatar: { backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  handle: { fontSize: 11.5, color: colors.inkSoft, fontFamily: 'JetBrainsMono_500Medium', marginTop: 2 },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.ink, minWidth: 72, alignItems: 'center' },
  sendBtnSent: { backgroundColor: colors.sandDeep, borderWidth: 1, borderColor: colors.line },
  sendBtnText: { fontSize: 12, fontWeight: '700', color: colors.sand },
  sendBtnTextSent: { color: colors.inkSoft },
  });
}
