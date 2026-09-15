import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { createGroupConversation } from '@/lib/conversations';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import EmptyState from '@/components/EmptyState';
import type { Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Minimum total participants (creator + 2 others) for something to count as
// a group rather than just a 1:1 DM — enforced again at the RLS level.
const MIN_MEMBERS = 2;

export default function NewGroupScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;

  const [following, setFollowing] = useState<Profile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!myId) return;
    (async () => {
      const [{ data: followRows }, { data: blockedRows }] = await Promise.all([
        supabase.from('follows').select('profile:profiles!follows_following_id_fkey(*)').eq('follower_id', myId),
        supabase.from('blocked_users').select('blocked_id').eq('blocker_id', myId),
      ]);
      const blockedIds = new Set((blockedRows ?? []).map((b) => b.blocked_id));
      const profiles = ((followRows ?? []) as unknown as { profile: Profile }[])
        .map((r) => r.profile)
        .filter((p) => p && !blockedIds.has(p.id));
      setFollowing(profiles);
      setLoaded(true);
    })();
  }, [myId]);

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? following.filter((p) => p.display_name.toLowerCase().includes(trimmed) || p.username.toLowerCase().includes(trimmed))
    : following;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const canCreate = selectedIds.size >= MIN_MEMBERS && !creating;

  const create = async () => {
    if (!myId || !canCreate) return;
    setCreating(true);
    try {
      const conversationId = await createGroupConversation(myId, Array.from(selectedIds), groupName.trim() || null);
      navigation.replace('Chat', { conversationId });
    } catch {
      showToast('Couldn’t create group — try again.', 'error');
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={17} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>New group</Text>
      </View>

      <TextInput
        style={styles.nameInput}
        placeholder="Group name (optional)"
        placeholderTextColor={colors.inkSoft}
        value={groupName}
        onChangeText={setGroupName}
      />

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
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 4, flexGrow: 1, paddingBottom: 90 }}
          ListEmptyComponent={
            <EmptyState
              icon="users"
              text={following.length === 0 ? 'You’re not following anyone yet.' : `No one matching "${query.trim()}"`}
            />
          }
          renderItem={({ item }) => {
            const selected = selectedIds.has(item.id);
            return (
              <Pressable style={styles.row} onPress={() => toggleSelected(item.id)} accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${item.display_name}`}>
                {item.avatar_url ? (
                  <Image source={{ uri: item.avatar_url }} style={styles.avatar} transition={200} />
                ) : (
                  <LinearGradient colors={['#0F8B82', '#FF5A3C']} style={styles.avatar} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.display_name}</Text>
                  <Text style={styles.handle}>@{item.username}</Text>
                </View>
                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                  {selected && <Feather name="check" size={13} color="white" />}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <View style={styles.footer}>
        <Pressable style={[styles.createBtn, !canCreate && styles.createBtnDisabled]} onPress={create} disabled={!canCreate} accessibilityLabel="Create group">
          {creating ? (
            <ActivityIndicator size="small" color={colors.sand} />
          ) : (
            <Text style={[styles.createBtnText, selectedIds.size < MIN_MEMBERS && styles.createBtnTextDisabled]}>
              {selectedIds.size < MIN_MEMBERS
                ? `Pick at least ${MIN_MEMBERS} people`
                : `Create group (${selectedIds.size})`}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 54, paddingBottom: 16, paddingHorizontal: spacing.lg },
  back: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 19, color: colors.ink },
  nameInput: {
    marginHorizontal: spacing.lg, marginBottom: 10, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line,
    borderRadius: radius.sm, paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, color: colors.ink,
  },
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
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: colors.coral, borderColor: colors.coral },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg,
    backgroundColor: colors.sand, borderTopWidth: 1, borderColor: colors.line,
  },
  createBtn: { backgroundColor: colors.coral, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center' },
  createBtnDisabled: { backgroundColor: colors.sandDeep, borderWidth: 1, borderColor: colors.line },
  createBtnText: { fontSize: 14, fontWeight: '700', color: 'white' },
  createBtnTextDisabled: { color: colors.inkSoft },
  });
}
