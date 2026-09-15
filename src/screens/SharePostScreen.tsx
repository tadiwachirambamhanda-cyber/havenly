import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator } from 'react-native';
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
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import EmptyState from '@/components/EmptyState';
import type { Post, Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'SharePost'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

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
  const [following, setFollowing] = useState<Profile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!myId) return;
    (async () => {
      // Following, not followers — the people you'd plausibly want to send
      // something to, not everyone who happens to follow you.
      const [{ data: postData }, { data: followRows }, { data: blockedRows }] = await Promise.all([
        supabase.from('posts').select('*').eq('id', postId).maybeSingle(),
        supabase.from('follows').select('profile:profiles!follows_following_id_fkey(*)').eq('follower_id', myId),
        supabase.from('blocked_users').select('blocked_id').eq('blocker_id', myId),
      ]);
      setPost(postData as Post);
      const blockedIds = new Set((blockedRows ?? []).map((b) => b.blocked_id));
      const profiles = ((followRows ?? []) as unknown as { profile: Profile }[])
        .map((r) => r.profile)
        .filter((p) => p && !blockedIds.has(p.id));
      setFollowing(profiles);
      setLoaded(true);
    })();
  }, [postId, myId]);

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? following.filter((p) => p.display_name.toLowerCase().includes(trimmed) || p.username.toLowerCase().includes(trimmed))
    : following;

  const sendTo = async (targetId: string) => {
    if (!myId || !post || sentIds.has(targetId)) return;
    setSendingId(targetId);
    try {
      const conversationId = await findOrCreateConversation(myId, targetId);
      const { error } = await supabase.from('messages')
        .insert({ conversation_id: conversationId, sender_id: myId, body: post.title, shared_post_id: post.id });
      if (error) throw error;
      await supabase.from('conversations')
        .update({ last_message: `📎 Shared: ${post.title}`, last_message_at: new Date().toISOString() })
        .eq('id', conversationId);
      haptics.confirm();
      setSentIds((prev) => new Set(prev).add(targetId));
    } catch {
      showToast('Couldn’t send — try again.', 'error');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={17} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Send to</Text>
      </View>
      <View style={styles.searchBar}>
        <Feather name="search" size={14} color={colors.inkSoft} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search people you follow…"
          placeholderTextColor={colors.inkSoft}
          value={query}
          onChangeText={setQuery}
        />
      </View>
      {!loaded ? (
        <ActivityIndicator color={colors.coral} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 4, flexGrow: 1 }}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              text={following.length === 0 ? 'You’re not following anyone yet.' : `No one matching "${query.trim()}"`}
            />
          }
          renderItem={({ item }) => {
            const sent = sentIds.has(item.id);
            return (
              <View style={styles.row}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatar} transition={200} />
                ) : (
                  <LinearGradient colors={['#0F8B82', '#FF5A3C']} style={styles.avatar} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.display_name}</Text>
                  <Text style={styles.handle}>@{item.username}</Text>
                </View>
                <Pressable
                  style={[styles.sendBtn, sent && styles.sendBtnSent]}
                  onPress={() => sendTo(item.id)}
                  disabled={sent || sendingId === item.id}
                  accessibilityLabel={sent ? `Sent to ${item.display_name}` : `Send to ${item.display_name}`}
                >
                  {sendingId === item.id ? (
                    <ActivityIndicator size="small" color={colors.ink} />
                  ) : (
                    <Text style={[styles.sendBtnText, sent && styles.sendBtnTextSent]}>{sent ? 'Sent ✓' : 'Send'}</Text>
                  )}
                </Pressable>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  name: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  handle: { fontSize: 11.5, color: colors.inkSoft, fontFamily: 'JetBrainsMono_500Medium', marginTop: 2 },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.ink, minWidth: 72, alignItems: 'center' },
  sendBtnSent: { backgroundColor: colors.sandDeep, borderWidth: 1, borderColor: colors.line },
  sendBtnText: { fontSize: 12, fontWeight: '700', color: colors.sand },
  sendBtnTextSent: { color: colors.inkSoft },
  });
}
