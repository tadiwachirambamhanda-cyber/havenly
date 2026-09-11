import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';
import type { Profile } from '@/types';

// STUB — port cover gradient, avatar, stats row, interest chips, and the
// posts/saved/tagged grid tabs from the HTML prototype's #profile screen.
// The "Log out" link below is temporary scaffolding so auth is testable
// end-to-end — replace it with the real settings entry point when this
// screen gets its full design pass.

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data as Profile);
    });
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.name}>{profile?.display_name ?? 'Loading…'}</Text>
      <Text style={styles.handle}>@{profile?.username}</Text>
      <Text style={styles.bio}>{profile?.bio}</Text>
      <Text style={styles.placeholder}>
        TODO(claude-code): port stats row, interest chips, and posts/saved/tagged grid tabs from the HTML prototype's #profile screen.
      </Text>
      <Pressable style={styles.logoutBtn} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand, paddingTop: 60, paddingHorizontal: spacing.lg },
  name: { fontFamily: 'Fraunces_600SemiBold', fontSize: 20, color: colors.ink },
  handle: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 12.5, color: colors.inkSoft, marginTop: 2 },
  bio: { fontSize: 13, color: '#3A4038', marginTop: 10, lineHeight: 20 },
  placeholder: { color: colors.inkSoft, marginTop: 24, lineHeight: 20 },
  logoutBtn: { marginTop: 32, marginBottom: 40, alignSelf: 'flex-start' },
  logoutText: { color: colors.coral, fontWeight: '700', fontSize: 13.5 },
});
