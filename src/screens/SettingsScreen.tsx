import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import AnimatedPressable from '@/components/AnimatedPressable';
import BackButton from '@/components/BackButton';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { type IconName } from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import type { ThemeMode } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { deleteOwnAccount } from '@/lib/account';
import ActionSheet from '@/components/ActionSheet';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MODE_OPTIONS: { key: ThemeMode; label: string; icon: IconName }[] = [
  { key: 'system', label: 'System', icon: 'smartphone' },
  { key: 'light', label: 'Light', icon: 'sun' },
  { key: 'dark', label: 'Dark', icon: 'moon' },
];

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const { colors, mode, setMode } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [deleting, setDeleting] = useState(false);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  const handleLogout = () => setLogoutConfirmVisible(true);
  const confirmLogout = () => supabase.auth.signOut();

  const handleDeleteAccount = () => setDeleteConfirmVisible(true);
  const confirmDeleteAccount = async () => {
    const userId = session?.user.id;
    if (!userId) return;
    setDeleting(true);
    try {
      await deleteOwnAccount(userId);
    } catch (e) {
      setDeleting(false);
      showToast(e instanceof Error ? e.message : 'Couldn’t delete your account. Please try again.', 'error');
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <BackButton style={styles.back}>
          <Icon name="arrow-left" size={17} color={colors.ink} />
        </BackButton>
        <Text style={styles.title}>Settings</Text>
      </View>

      <Text style={styles.sectionLabel}>Appearance</Text>
      <View style={styles.segmentRow}>
        {MODE_OPTIONS.map((opt) => {
          const isSelected = mode === opt.key;
          return (
            <AnimatedPressable
              key={opt.key}
              style={[styles.segment, isSelected && styles.segmentActive]}
              onPress={() => { haptics.tap(); setMode(opt.key); }}
              accessibilityLabel={`${opt.label} appearance`}
            >
              <Icon name={opt.icon} size={14} color={isSelected ? colors.sand : colors.inkSoft} />
              <Text style={[styles.segmentText, isSelected && styles.segmentTextActive]}>{opt.label}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      <View style={styles.divider} />

      <AnimatedPressable style={styles.row} onPress={() => navigation.navigate('BlockedUsers')}>
        <Text style={styles.rowText}>Blocked accounts</Text>
        <Text style={styles.chevron}>›</Text>
      </AnimatedPressable>

      <View style={styles.divider} />

      <AnimatedPressable style={styles.row} onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}>
        <Text style={styles.rowText}>Privacy policy</Text>
        <Text style={styles.chevron}>›</Text>
      </AnimatedPressable>

      <View style={styles.divider} />

      <AnimatedPressable style={styles.row} onPress={() => navigation.navigate('Legal', { doc: 'terms' })}>
        <Text style={styles.rowText}>Terms of use</Text>
        <Text style={styles.chevron}>›</Text>
      </AnimatedPressable>

      {profile?.is_admin && (
        <>
          <View style={styles.divider} />
          <AnimatedPressable style={styles.row} onPress={() => navigation.navigate('ManageHousing')}>
            <Text style={styles.rowText}>Manage housing</Text>
            <Text style={styles.chevron}>›</Text>
          </AnimatedPressable>
          <View style={styles.divider} />
          <AnimatedPressable style={styles.row} onPress={() => navigation.navigate('CreateEvent')}>
            <Text style={styles.rowText}>Create event</Text>
            <Text style={styles.chevron}>›</Text>
          </AnimatedPressable>
          <View style={styles.divider} />
          <AnimatedPressable style={styles.row} onPress={() => navigation.navigate('ManageBrands')}>
            <Text style={styles.rowText}>Manage brands</Text>
            <Text style={styles.chevron}>›</Text>
          </AnimatedPressable>
          <View style={styles.divider} />
          <AnimatedPressable style={styles.row} onPress={() => navigation.navigate('CreateOffer')}>
            <Text style={styles.rowText}>Create offer</Text>
            <Text style={styles.chevron}>›</Text>
          </AnimatedPressable>
        </>
      )}

      <View style={styles.divider} />

      <AnimatedPressable style={styles.row} onPress={handleLogout}>
        <Text style={[styles.rowText, styles.logoutText]}>Log out</Text>
      </AnimatedPressable>

      <View style={styles.divider} />

      <AnimatedPressable style={styles.row} onPress={handleDeleteAccount} disabled={deleting}>
        <Text style={[styles.rowText, styles.deleteText]}>Delete account</Text>
        {deleting && <ActivityIndicator color={colors.coral} size="small" />}
      </AnimatedPressable>

      <ActionSheet
        visible={logoutConfirmVisible}
        onClose={() => setLogoutConfirmVisible(false)}
        title="Log out?"
        actions={[{ label: 'Log out', destructive: true, onPress: confirmLogout }]}
      />
      <ActionSheet
        visible={deleteConfirmVisible}
        onClose={() => setDeleteConfirmVisible(false)}
        title="Delete your account?"
        message="This permanently deletes your profile, posts, comments, and messages. This can’t be undone."
        actions={[{ label: 'Delete account', destructive: true, onPress: confirmDeleteAccount }]}
      />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 16, paddingHorizontal: spacing.lg },
    back: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 19, color: colors.ink },
    sectionLabel: {
      fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft,
      fontWeight: '600', paddingHorizontal: spacing.lg, marginBottom: 10,
    },
    segmentRow: {
      flexDirection: 'row', gap: 6, marginHorizontal: spacing.lg, backgroundColor: colors.sandDeep,
      borderRadius: 100, padding: 4,
    },
    segment: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 9, borderRadius: 100,
    },
    segmentActive: { backgroundColor: colors.ink },
    segmentText: { fontSize: 12.5, fontWeight: '700', color: colors.inkSoft },
    segmentTextActive: { color: colors.sand },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 16 },
    rowText: { fontSize: 14, fontWeight: '600', color: colors.ink },
    chevron: { fontSize: 18, color: colors.inkSoft },
    divider: { height: 1, backgroundColor: colors.line, marginHorizontal: spacing.lg, marginTop: 16 },
    logoutText: { color: colors.coral },
    deleteText: { color: colors.coral },
  });
}
