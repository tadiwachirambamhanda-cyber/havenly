import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { colors, radius, spacing, gradients } from '@/theme/tokens';
import { INTEREST_OPTIONS } from '@/constants/interests';
import type { Post, Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type GridTab = 'posts' | 'saved' | 'tagged';

const GRID_TABS: { key: GridTab; label: string }[] = [
  { key: 'posts', label: 'Posts' }, { key: 'saved', label: 'Saved' }, { key: 'tagged', label: 'Tagged' },
];

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<GridTab>('posts');

  const load = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) return;

    const [{ data: profileData }, { count: postCount }, { count: followerCount }, { count: followingCount }, { data: postData }] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('author_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
        supabase.from('posts').select('*').eq('author_id', userId).order('created_at', { ascending: false }),
      ]);

    setProfile(profileData as Profile);
    setStats({ posts: postCount ?? 0, followers: followerCount ?? 0, following: followingCount ?? 0 });
    setPosts((postData as Post[]) ?? []);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  if (!profile) return null;

  const interestChips = INTEREST_OPTIONS.filter((opt) => profile.interests.includes(opt.key));

  return (
    <FlatList
      style={styles.container}
      data={activeTab === 'posts' ? posts : []}
      keyExtractor={(item) => item.id}
      numColumns={3}
      columnWrapperStyle={{ gap: 2 }}
      contentContainerStyle={{ paddingBottom: 40 }}
      renderItem={({ item, index }) => {
        const [from, to] = gradients[index % gradients.length];
        return (
          <View style={styles.gridCell}>
            <LinearGradient colors={[from, to]} style={StyleSheet.absoluteFill} />
            {item.image_url && <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" />}
          </View>
        );
      }}
      ListEmptyComponent={
        <Text style={styles.gridEmpty}>
          {activeTab === 'posts' ? 'No posts yet.' : activeTab === 'saved' ? 'Nothing saved yet.' : 'No tagged posts yet.'}
        </Text>
      }
      ListHeaderComponent={
        <View>
          <LinearGradient colors={['#FF7A5C', '#E3A23A', '#0F8B82']} locations={[0, 0.6, 1]} style={styles.cover} />
          <View style={styles.avatarRow}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <LinearGradient colors={['#0F8B82', '#FF5A3C']} style={styles.avatar} />
            )}
            <Pressable style={styles.editBtn} onPress={() => Alert.alert('Coming soon', 'Editing your profile isn\'t built yet.')}>
              <Text style={styles.editBtnText}>Edit profile</Text>
            </Pressable>
          </View>

          <Text style={styles.name}>{profile.display_name}</Text>
          <Text style={styles.handle}>@{profile.username}{profile.university ? ` · ${profile.university}` : ''}</Text>
          {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

          <View style={styles.statsRow}>
            <View><Text style={styles.statNum}>{stats.posts}</Text><Text style={styles.statLabel}>Posts</Text></View>
            <View><Text style={styles.statNum}>{stats.followers}</Text><Text style={styles.statLabel}>Followers</Text></View>
            <View><Text style={styles.statNum}>{stats.following}</Text><Text style={styles.statLabel}>Following</Text></View>
          </View>

          {interestChips.length > 0 && (
            <View style={styles.chipRow}>
              {interestChips.map((chip) => (
                <View key={chip.key} style={styles.chip}><Text style={styles.chipText}>{chip.label}</Text></View>
              ))}
            </View>
          )}

          <View style={styles.tabRow}>
            {GRID_TABS.map((tab) => (
              <Pressable key={tab.key} style={styles.tab} onPress={() => setActiveTab(tab.key)}>
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
                {activeTab === tab.key && <View style={styles.tabUnderline} />}
              </Pressable>
            ))}
          </View>
        </View>
      }
      ListFooterComponent={
        <View>
          <Pressable style={styles.footerLink} onPress={() => navigation.navigate('BlockedUsers')}>
            <Text style={styles.footerLinkText}>Blocked accounts</Text>
          </Pressable>
          <Pressable style={styles.logoutBtn} onPress={() => supabase.auth.signOut()}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  cover: { height: 110 },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginTop: -38 },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.sand },
  editBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, marginBottom: 6 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  name: { fontFamily: 'Fraunces_600SemiBold', fontSize: 20, color: colors.ink, paddingHorizontal: spacing.lg, paddingTop: 12 },
  handle: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 12.5, color: colors.inkSoft, paddingHorizontal: spacing.lg, marginTop: 2 },
  bio: { fontSize: 13, color: '#3A4038', paddingHorizontal: spacing.lg, marginTop: 10, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 22, paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 6 },
  statNum: { fontSize: 16, fontWeight: '800', color: colors.ink },
  statLabel: { fontSize: 10.5, color: colors.inkSoft, fontWeight: '600', marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.coralSoft },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.coral },
  tabRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, marginTop: 6 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  tabTextActive: { color: colors.ink },
  tabUnderline: { position: 'absolute', bottom: -1, height: 2, width: '60%', backgroundColor: colors.coral, borderRadius: 1 },
  gridCell: { flex: 1, aspectRatio: 1 / 1.15, overflow: 'hidden', marginBottom: 2 },
  gridEmpty: { color: colors.inkSoft, textAlign: 'center', paddingVertical: 40, fontSize: 13 },
  footerLink: { alignItems: 'center', paddingTop: 24 },
  footerLinkText: { color: colors.inkSoft, fontWeight: '600', fontSize: 13 },
  logoutBtn: { alignItems: 'center', paddingVertical: 24 },
  logoutText: { color: colors.coral, fontWeight: '700', fontSize: 13.5 },
});
