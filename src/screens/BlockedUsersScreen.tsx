import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import InitialsAvatar from '@/components/InitialsAvatar';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { haptics } from '@/lib/haptics';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import EmptyState from '@/components/EmptyState';
import SwipeToAction from '@/components/SwipeToAction';
import type { Profile } from '@/types';

export default function BlockedUsersScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [blocked, setBlocked] = useState<Profile[]>([]);

  const load = useCallback(async () => {
    const myId = session?.user.id;
    if (!myId) return;
    const { data: blocks } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', myId);
    const blockedIds = (blocks ?? []).map((b) => b.blocked_id);
    if (!blockedIds.length) { setBlocked([]); return; }
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', blockedIds);
    setBlocked((profiles as Profile[]) ?? []);
  }, [session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unblock = async (blockedId: string) => {
    const myId = session?.user.id;
    if (!myId) return;
    haptics.tap();
    await supabase.from('blocked_users').delete().eq('blocker_id', myId).eq('blocked_id', blockedId);
    setBlocked((prev) => prev.filter((p) => p.id !== blockedId));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton style={styles.back}>
          <Icon name="arrow-left" size={17} color={colors.ink} />
        </BackButton>
        <Text style={styles.title}>Blocked accounts</Text>
      </View>
      <FlatList
        data={blocked}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg }}
        renderItem={({ item }) => (
          <SwipeToAction actionLabel="Unblock" onAction={() => unblock(item.id)}>
            <View style={styles.row}>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.avatar} transition={200} />
              ) : (
                <InitialsAvatar name={item.display_name} style={styles.avatar} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.display_name}</Text>
                <Text style={styles.handle}>@{item.username}</Text>
              </View>
              <AnimatedPressable style={styles.unblockBtn} onPress={() => unblock(item.id)} accessibilityLabel={`Unblock ${item.display_name}`}>
                <Text style={styles.unblockText}>Unblock</Text>
              </AnimatedPressable>
            </View>
          </SwipeToAction>
        )}
        ListEmptyComponent={<EmptyState icon="shield-check" text="You haven't blocked anyone." />}
      />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 54, paddingBottom: 16, paddingHorizontal: spacing.lg },
  back: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 19, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  name: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  handle: { fontSize: 11.5, color: colors.inkSoft, fontFamily: 'JetBrainsMono_500Medium', marginTop: 2 },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.button, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  unblockText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  placeholder: { color: colors.inkSoft, textAlign: 'center', marginTop: 40 },
  });
}
