import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { Text } from '@/components/Text';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import InitialsAvatar from '@/components/InitialsAvatar';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useUnreadNotifications } from '@/lib/useUnreadNotifications';
import { useTheme } from '@/lib/ThemeContext';
import { radius, spacing, tones } from '@/theme/tokens';
import Skeleton from '@/components/Skeleton';
import type { ColorTokens } from '@/theme/tokens';
import type { Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ROWS: { label: string; icon: 'file-text' | 'bell'; go: (nav: Nav) => void }[] = [
  { label: 'My enquiries', icon: 'file-text', go: (nav) => nav.navigate('MyEnquiries') },
  { label: 'Notifications', icon: 'bell', go: (nav) => nav.navigate('Notifications') },
];

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasUnreadNotifs = useUnreadNotifications();
  // The avatar normally overlaps the cover by 38px; on tall-inset devices the
  // settings button would collide with it, so pull the avatar down further.
  const avatarMarginTop = Math.max(-38, insets.top - 52);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const load = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data as Profile);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      (async () => { await load(); setHasLoadedOnce(true); })();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (!profile) {
    if (hasLoadedOnce) return null;
    return (
      <View style={styles.container}>
        <Skeleton style={{ height: 110, borderRadius: 0 }} />
        <View style={[styles.avatarRow, { marginTop: avatarMarginTop }]}>
          <Skeleton style={{ width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.sand }} />
          <Skeleton style={{ width: 96, height: 32, borderRadius: radius.button, marginBottom: 6 }} />
        </View>
        <Skeleton style={{ height: 20, width: '50%', marginTop: 12, marginHorizontal: spacing.lg }} />
        <Skeleton style={{ height: 13, width: '35%', marginTop: 8, marginHorizontal: spacing.lg }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
    >
      {profile.cover_url ? (
        <Image source={{ uri: profile.cover_url }} style={styles.cover} contentFit="cover" transition={200} />
      ) : (
        <LinearGradient colors={[...tones.coral]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cover} />
      )}
      <Pressable hitSlop={8}
        style={[styles.settingsBtn, { top: insets.top + 12 }]}
        onPress={() => navigation.navigate('Settings')}
        accessibilityLabel="Settings"
      >
        <Icon name="settings" size={17} color="#1F1B16" />
      </Pressable>
      <View style={[styles.avatarRow, { marginTop: avatarMarginTop }]}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} transition={200} />
        ) : (
          <InitialsAvatar name={profile.display_name} style={styles.avatar} />
        )}
        <Pressable style={styles.editBtn} onPress={() => navigation.navigate('EditProfile')} accessibilityLabel="Edit profile">
          <Text style={styles.editBtnText}>Edit profile</Text>
        </Pressable>
      </View>

      <Text style={styles.name}>{profile.display_name}</Text>
      <Text style={styles.handle}>{profile.university ?? ''}</Text>
      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      <View style={{ marginTop: 24 }}>
        {ROWS.map((row) => (
          <Pressable key={row.label} style={styles.listRow} onPress={() => row.go(navigation)} accessibilityRole="button" accessibilityLabel={row.label}>
            <Icon name={row.icon} size={18} color={colors.ink} />
            <Text style={styles.listRowText}>{row.label}</Text>
            {row.label === 'Notifications' && hasUnreadNotifs && <View style={styles.newDot} accessibilityLabel="New updates" />}
            <Icon name="chevron-right" size={14} color={colors.inkSoft} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  newDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coralFill },
  listRowText: { flex: 1, fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 16, color: colors.ink },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingHorizontal: 0, marginTop: 20 },
  skeletonGridCell: { width: '33%', aspectRatio: 1 / 1.15, borderRadius: 0 },
  cover: { height: 110 },
  settingsBtn: {
    position: 'absolute', right: 16, width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(251,245,234,0.92)', alignItems: 'center', justifyContent: 'center',
  },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginTop: -38 },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.sand },
  editBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.button, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, marginBottom: 6 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  name: { fontFamily: 'SchibstedGrotesk_600SemiBold', fontSize: 20, color: colors.ink, paddingHorizontal: spacing.lg, paddingTop: 12 },
  handle: { fontSize: 12.5, color: colors.inkSoft, paddingHorizontal: spacing.lg, marginTop: 2 },
  bio: { fontSize: 13, color: colors.inkSoft, paddingHorizontal: spacing.lg, marginTop: 10, lineHeight: 20 },
  statsRow: { flexDirection: 'row', gap: 22, paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: 6 },
  statNum: { fontSize: 16, fontWeight: '800', color: colors.ink },
  streakStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statLabel: { fontSize: 10.5, color: colors.inkSoft, fontWeight: '600', marginTop: 2 },
  perksRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, paddingTop: 10 },
  perksRowText: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.ink },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.tag, backgroundColor: colors.sandDeep },
  chipText: { fontSize: 11, fontWeight: '700', color: colors.ink },
  tabRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, marginTop: 6 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  tabTextActive: { color: colors.ink },
  tabUnderline: { position: 'absolute', bottom: -1, height: 2, width: '60%', backgroundColor: colors.coralFill, borderRadius: 1 },
  gridCell: { flex: 1, aspectRatio: 1 / 1.15, overflow: 'hidden', marginBottom: 2 },
  // Text-only post in the grid: its title on a quiet tile, not a colour block.
  gridText: { flex: 1, backgroundColor: colors.sandDeep, padding: 10, justifyContent: 'flex-end' },
  gridTextTitle: { fontSize: 12, fontWeight: '700', color: colors.ink, lineHeight: 16 },
  gridEmpty: { color: colors.inkSoft, textAlign: 'center', paddingVertical: 40, fontSize: 13 },
  });
}
