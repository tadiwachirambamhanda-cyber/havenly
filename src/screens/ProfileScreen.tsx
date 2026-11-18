import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Text';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import InitialsAvatar from '@/components/InitialsAvatar';
import Icon from '@/components/Icon';
import ActionSheet from '@/components/ActionSheet';
import AnimatedPressable from '@/components/AnimatedPressable';
import Skeleton from '@/components/Skeleton';
import { OutlineButton } from '@/components/housing/parts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { useUnreadNotifications } from '@/lib/useUnreadNotifications';
import { deleteOwnAccount } from '@/lib/account';
import { ENQUIRY_STATUS_LABEL } from '@/lib/housing';
import { preferenceSummary } from '@/lib/profilePrefs';
import { timeAgo } from '@/utils/timeAgo';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { EnquiryKind, EnquiryStatus, Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface EnquiryRow {
  id: string; kind: EnquiryKind; status: EnquiryStatus; status_updated_at: string;
  residence: { id: string; name: string } | null;
}

export default function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { session, isGuest } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasUnreadNotifs = useUnreadNotifications();

  // Loaded data is tagged with the account it belongs to; a slow load that finishes after the account changed
  // is never shown, so one person never sees another's profile or enquiries on a shared device.
  const [data, setData] = useState<{ owner: string; profile: Profile | null; enquiries: EnquiryRow[]; enquiriesFailed: boolean } | null>(null);
  const mine = data && data.owner === session?.user.id ? data : null;
  const profile = mine?.profile ?? null;
  const enquiries = mine ? mine.enquiries : null;
  const enquiriesFailed = mine?.enquiriesFailed ?? false;
  const [refreshing, setRefreshing] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Only the latest request may update the screen, so a slow older one cannot overwrite a newer result.
  const latestLoad = useRef(0);
  const load = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) return;
    const loadId = ++latestLoad.current;
    const [profileRes, enquiryRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('housing_enquiries')
        .select('id, kind, status, status_updated_at, residence:residences(id, name)')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
    ]);
    if (loadId !== latestLoad.current) return;
    setData({
      owner: userId,
      profile: (profileRes.data as Profile) ?? null,
      enquiries: enquiryRes.error ? [] : ((enquiryRes.data as unknown as EnquiryRow[]) ?? []),
      enquiriesFailed: !!enquiryRes.error,
    });
  }, [session]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const confirmLogout = () => supabase.auth.signOut();
  const confirmDelete = async () => {
    const userId = session?.user.id;
    if (!userId) return;
    if (isGuest) { showToast('Demo mode: make an account to manage one.', 'error'); return; }
    setDeleting(true);
    try {
      await deleteOwnAccount(userId);
    } catch (e) {
      setDeleting(false);
      showToast(e instanceof Error ? e.message : 'Couldn’t delete your account. Please try again.', 'error');
    }
  };

  if (!profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 24 }]} accessibilityLabel="Loading your profile">
        <View style={styles.headRow}>
          <Skeleton style={{ width: 72, height: 72, borderRadius: 36 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton style={{ height: 22, width: '55%' }} />
            <Skeleton style={{ height: 14, width: '40%' }} />
          </View>
        </View>
      </View>
    );
  }

  const summary = preferenceSummary(profile);
  const email = session?.user.email;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 130, paddingTop: insets.top + 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
    >
      <View style={styles.topBar}>
        <Text style={styles.screenTitle} accessibilityRole="header">Profile</Text>
        <Pressable hitSlop={8} style={styles.iconBtn} onPress={() => navigation.navigate('Settings')} accessibilityRole="button" accessibilityLabel="Settings">
          <Icon name="settings" size={18} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.headRow}>
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} transition={200} />
        ) : (
          <InitialsAvatar name={profile.display_name} style={styles.avatar} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{profile.display_name}</Text>
          {profile.university ? <Text style={styles.sub} numberOfLines={1}>{profile.university}</Text> : <Text style={styles.sub}>Add your university</Text>}
        </View>
        <OutlineButton label="Edit" onPress={() => navigation.navigate('EditProfile')} height={44} />
      </View>
      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      <View style={styles.sectionHead}>
        <Text style={styles.section}>My enquiries</Text>
        {hasUnreadNotifs ? <View style={styles.newDot} accessibilityLabel="New updates" /> : null}
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => navigation.navigate('MyEnquiries')} accessibilityRole="button" accessibilityLabel="See all enquiries" hitSlop={8}>
          <Text style={styles.link}>See all</Text>
        </Pressable>
      </View>
      {enquiries === null ? (
        <Skeleton style={{ height: 64, marginHorizontal: spacing.lg, borderRadius: 14 }} />
      ) : enquiriesFailed ? (
        <Text style={styles.muted}>We could not load your enquiries. Pull down to try again.</Text>
      ) : enquiries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No enquiries yet</Text>
          <Text style={styles.muted2}>Ask a residence a question or book a viewing from its page.</Text>
          <OutlineButton label="Find a place" onPress={() => navigation.navigate('MainTabs', { screen: 'Housing' })} height={44} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
        </View>
      ) : (
        <View style={styles.card}>
          {enquiries.map((e, i) => (
            <Pressable
              key={e.id}
              style={[styles.enquiryRow, i > 0 && styles.rowDivider]}
              onPress={() => navigation.navigate('MyEnquiries')}
              accessibilityRole="button"
              accessibilityLabel={`${e.residence?.name ?? 'A place'}, ${ENQUIRY_STATUS_LABEL[e.status]}`}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.enquiryName} numberOfLines={1}>{e.residence?.name ?? 'A place'}</Text>
                <Text style={styles.muted2}>{e.kind === 'viewing' ? 'Viewing request' : 'Question'} · {timeAgo(e.status_updated_at)}</Text>
              </View>
              <View style={styles.statusChip}><Text style={styles.statusText}>{ENQUIRY_STATUS_LABEL[e.status]}</Text></View>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={[styles.section, styles.sectionPad]}>What I’m looking for</Text>
      <Pressable style={styles.card} onPress={() => navigation.navigate('EditProfile')} accessibilityRole="button" accessibilityLabel="Edit what I’m looking for">
        <View style={styles.prefRow}>
          <View style={{ flex: 1 }}>
            {summary ? <Text style={styles.prefText}>{summary}</Text> : (
              <>
                <Text style={styles.enquiryName}>Set your budget and move-in month</Text>
                <Text style={styles.muted2}>Saved here, your enquiries start filled in.</Text>
              </>
            )}
          </View>
          <Icon name="chevron-right" size={14} color={colors.inkSoft} />
        </View>
      </Pressable>

      <Text style={[styles.section, styles.sectionPad]}>Housemates</Text>
      <View style={styles.card}>
        <View style={styles.housemateBody}>
          <Text style={styles.enquiryName}>Want to live with other students?</Text>
          <Text style={styles.muted2}>Make a card so students who want to live together can find you. The team checks every card first.</Text>
          <View style={styles.housemateBtns}>
            <OutlineButton label="See the board" icon="users" onPress={() => navigation.navigate('HousemateBoard')} height={44} />
            <OutlineButton label="My card" onPress={() => navigation.navigate('MyHousemateCard')} height={44} />
          </View>
        </View>
      </View>

      <Text style={[styles.section, styles.sectionPad]}>Account</Text>
      <View style={styles.card}>
        {email ? (
          <View style={styles.accountRow}>
            <Text style={styles.accountLabel}>Email</Text>
            <Text style={styles.accountValue} numberOfLines={1}>{email}</Text>
          </View>
        ) : null}
        <Pressable style={[styles.accountRow, email ? styles.rowDivider : null]} onPress={() => navigation.navigate('ChangePassword')} accessibilityRole="button">
          <Text style={styles.accountAction}>Change password</Text>
          <View style={{ flex: 1 }} />
          <Icon name="chevron-right" size={14} color={colors.inkSoft} />
        </Pressable>
        <Pressable style={[styles.accountRow, styles.rowDivider]} onPress={() => navigation.navigate('Notifications')} accessibilityRole="button">
          <Text style={styles.accountAction}>Notifications</Text>
          {hasUnreadNotifs ? <View style={styles.newDot} accessibilityLabel="New updates" /> : null}
          <View style={{ flex: 1 }} />
          <Icon name="chevron-right" size={14} color={colors.inkSoft} />
        </Pressable>
        <AnimatedPressable style={[styles.accountRow, styles.rowDivider]} onPress={() => setLogoutConfirm(true)} accessibilityRole="button">
          <Text style={styles.accountAction}>Log out</Text>
        </AnimatedPressable>
        <AnimatedPressable style={[styles.accountRow, styles.rowDivider]} onPress={() => setDeleteConfirm(true)} disabled={deleting} accessibilityRole="button">
          <Text style={styles.deleteText}>Delete account</Text>
          {deleting ? <ActivityIndicator color={colors.coral} size="small" /> : null}
        </AnimatedPressable>
      </View>

      <ActionSheet
        visible={logoutConfirm}
        onClose={() => setLogoutConfirm(false)}
        title="Log out?"
        actions={[{ label: 'Log out', destructive: true, onPress: confirmLogout }]}
      />
      <ActionSheet
        visible={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title="Delete your account?"
        message="This permanently deletes your profile, saved places, enquiries and messages. This can’t be undone."
        actions={[{ label: 'Delete account', destructive: true, onPress: confirmDelete }]}
      />
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: 16 },
    screenTitle: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 30, letterSpacing: -0.6, color: colors.ink },
    iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: spacing.lg },
    avatar: { width: 72, height: 72, borderRadius: 36 },
    name: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 22, color: colors.ink },
    sub: { fontSize: 14, color: colors.inkSoft, marginTop: 2 },
    bio: { fontSize: 14, lineHeight: 20, color: colors.inkBody, paddingHorizontal: spacing.lg, marginTop: 12 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, marginTop: 28, marginBottom: 10 },
    section: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 19, color: colors.ink },
    sectionPad: { paddingHorizontal: spacing.lg, marginTop: 28, marginBottom: 10 },
    link: { fontSize: 14, fontWeight: '700', color: colors.coral },
    card: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, marginHorizontal: spacing.lg, overflow: 'hidden' },
    emptyCard: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, marginHorizontal: spacing.lg, padding: 16 },
    emptyTitle: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 16, color: colors.ink, marginBottom: 2 },
    muted: { fontSize: 14, color: colors.inkSoft, paddingHorizontal: spacing.lg },
    muted2: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
    enquiryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 10 },
    rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
    enquiryName: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 15, color: colors.ink },
    statusChip: { backgroundColor: colors.tintBg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
    statusText: { fontSize: 12, fontWeight: '700', color: colors.tintText },
    prefRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12 },
    housemateBody: { padding: 16, gap: 6 },
    housemateBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
    prefText: { fontSize: 15, lineHeight: 21, color: colors.ink },
    accountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingHorizontal: 16 },
    accountLabel: { fontSize: 14, color: colors.inkSoft },
    accountValue: { flex: 1, fontSize: 14, color: colors.ink, textAlign: 'right' },
    accountAction: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: colors.ink },
    deleteText: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: colors.errorText },
    newDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coralFill },
  });
}
