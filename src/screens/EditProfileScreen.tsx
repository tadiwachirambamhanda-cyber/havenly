import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import InitialsAvatar from '@/components/InitialsAvatar';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { useConfirmDiscard } from '@/lib/useConfirmDiscard';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import UniversityPickerModal from '@/components/UniversityPickerModal';
import { Notice, PrimaryButton } from '@/components/housing/parts';
import { upcomingMonths, formatMonth } from '@/lib/housing';
import { HOUSEMATE_PREF_OPTIONS, parseBudget, type HousematePref } from '@/lib/profilePrefs';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [university, setUniversity] = useState(profile?.university ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url ?? null);
  const [newAvatarPicked, setNewAvatarPicked] = useState(false);
  const [budgetText, setBudgetText] = useState(profile?.budget_aed != null ? String(profile.budget_aed) : '');
  const [moveIn, setMoveIn] = useState<string | null>(profile?.move_in_month ?? null);
  const [housemates, setHousemates] = useState<HousematePref | null>(profile?.housemate_pref ?? null);
  const [gender, setGender] = useState<'female' | 'male' | null>(profile?.gender ?? null);
  const months = useMemo(() => upcomingMonths(12), []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [universityPickerVisible, setUniversityPickerVisible] = useState(false);

  const allowLeave = useConfirmDiscard(!saved && (
    displayName !== (profile?.display_name ?? '')
    || username !== (profile?.username ?? '')
    || bio !== (profile?.bio ?? '')
    || university !== (profile?.university ?? '')
    || newAvatarPicked
    || budgetText.trim() !== (profile?.budget_aed != null ? String(profile.budget_aed) : '')
    || moveIn !== (profile?.move_in_month ?? null)
    || housemates !== (profile?.housemate_pref ?? null)
    || gender !== (profile?.gender ?? null)
  ));

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri);
      setNewAvatarPicked(true);
    }
  };

  const save = async () => {
    setError(null);
    if (!session?.user) return;
    if (!displayName.trim()) { setError('Add a display name.'); return; }
    if (!username.trim()) { setError('Add a username.'); return; }
    const budget = parseBudget(budgetText);
    if (budget.error) { setError(budget.error); return; }

    setSaving(true);
    try {
      let avatarUrl = profile?.avatar_url ?? null;
      if (newAvatarPicked && avatarUri) {
        const ext = avatarUri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const path = `${session.user.id}/${Date.now()}.${ext}`;
        const arrayBuffer = await fetch(avatarUri).then((r) => r.arrayBuffer());
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, arrayBuffer, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        });
        if (uploadError) throw uploadError;
        avatarUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      }

      const { error: updateError } = await supabase.from('profiles').update({
        display_name: displayName.trim(),
        username: username.trim(),
        bio: bio.trim() || null,
        university: university.trim() || null,
        avatar_url: avatarUrl,
      }).eq('id', session.user.id);

      if (updateError) {
        if (updateError.code === '23505') throw new Error('That username is already taken.');
        throw updateError;
      }

      // Budget, move-in month, housemate preference and gender are private: they have their own table.
      const { error: privateError } = await supabase.from('profile_private').upsert({
        user_id: session.user.id,
        budget_aed: budget.value,
        move_in_month: moveIn,
        housemate_pref: housemates,
        gender,
      }, { onConflict: 'user_id' });
      if (privateError) throw privateError;

      await refreshProfile();
      haptics.success();
      setSaved(true);
      allowLeave();
      navigation.goBack();
      showToast('Profile updated');
    } catch (e) {
      // Supabase/PostgREST errors are plain objects with a `message` field,
      // not real Error instances — `e instanceof Error` misses them and was
      // masking the actual failure behind a generic message.
      const message = e instanceof Error ? e.message : (e && typeof e === 'object' && 'message' in e ? String(e.message) : 'Failed to save profile.');
      setError(message);
      console.error('Failed to save profile:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <AnimatedPressable onPress={() => navigation.goBack()} accessibilityLabel="Cancel"><Text style={styles.headerBtn}>Cancel</Text></AnimatedPressable>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <AnimatedPressable onPress={save} disabled={saving} accessibilityLabel="Save profile">
          {saving ? <ActivityIndicator color={colors.coral} /> : <Text style={[styles.headerBtn, styles.saveBtn]}>Save</Text>}
        </AnimatedPressable>
      </View>

      {error ? <Notice style={{ marginHorizontal: spacing.lg, marginBottom: 8 }}>{error}</Notice> : null}

      <AnimatedPressable style={styles.avatarWrap} onPress={pickAvatar} accessibilityLabel="Change profile photo">
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} transition={200} />
        ) : (
          <InitialsAvatar name={displayName} style={styles.avatar} />
        )}
        <View style={styles.avatarEditBadge}>
          <Icon name="camera" size={11} color="white" />
        </View>
      </AnimatedPressable>

      <Text style={styles.label}>Display name</Text>
      <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Your name" placeholderTextColor={colors.inkSoft} />

      <Text style={styles.label}>Username</Text>
      <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="username" placeholderTextColor={colors.inkSoft} />

      <Text style={styles.label}>Bio</Text>
      <TextInput style={[styles.input, styles.bioInput]} value={bio} onChangeText={setBio} multiline placeholder="Tell people a bit about you" placeholderTextColor={colors.inkSoft} />

      <Text style={styles.label}>University</Text>
      <AnimatedPressable style={styles.input} onPress={() => setUniversityPickerVisible(true)}>
        <Text style={university ? styles.universityValue : styles.universityPlaceholder}>
          {university || 'Select your university'}
        </Text>
      </AnimatedPressable>
      <UniversityPickerModal
        visible={universityPickerVisible}
        selected={university || null}
        onClose={() => setUniversityPickerVisible(false)}
        onSelect={(name) => setUniversity(name ?? '')}
      />

      <Text style={styles.section}>What I’m looking for</Text>
      <Text style={styles.sectionHint}>Optional. Saved here so your enquiries start filled in.</Text>

      <Text style={styles.label}>Monthly budget (AED)</Text>
      <TextInput
        style={styles.input}
        value={budgetText}
        onChangeText={setBudgetText}
        keyboardType="number-pad"
        placeholder="For example 3000"
        placeholderTextColor={colors.inkSoft}
        accessibilityLabel="Monthly budget in AED"
        maxLength={9}
      />

      <Text style={styles.label}>Move in from</Text>
      <View style={styles.chipGrid}>
        {months.map((m) => {
          const on = moveIn === m;
          return (
            <AnimatedPressable key={m} style={[styles.chip, on && styles.chipOn]} onPress={() => { haptics.tap(); setMoveIn(on ? null : m); }} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{formatMonth(m)}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      <Text style={styles.label}>My gender (optional)</Text>
      <View style={styles.chipGrid}>
        {([{ key: 'female', label: 'Woman' }, { key: 'male', label: 'Man' }] as const).map((o) => {
          const on = gender === o.key;
          return (
            <AnimatedPressable key={o.key} style={[styles.chip, on && styles.chipOn]} onPress={() => { haptics.tap(); setGender(on ? null : o.key); }} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
            </AnimatedPressable>
          );
        })}
      </View>
      <Text style={styles.sectionHint}>Used only to match housemate preferences. It is shown on your housemate card, if you make one, and nowhere else.</Text>

      <Text style={styles.label}>I would live with</Text>
      <View style={styles.chipGrid}>
        {HOUSEMATE_PREF_OPTIONS.map((o) => {
          const on = housemates === o.key;
          return (
            <AnimatedPressable key={o.key} style={[styles.chip, on && styles.chipOn]} onPress={() => { haptics.tap(); setHousemates(on ? null : o.key); }} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: 28 }}>
        <PrimaryButton label="Save" onPress={save} loading={saving} />
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontFamily: 'SchibstedGrotesk_600SemiBold', fontSize: 17, color: colors.ink },
  headerBtn: { fontSize: 14, fontWeight: '600', color: colors.inkSoft },
  saveBtn: { color: colors.coral, fontWeight: '700' },
  avatarWrap: { alignSelf: 'flex-start', marginTop: 8, marginLeft: spacing.lg, marginBottom: 20 },
  avatar: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.sand },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 2, borderColor: colors.sand, alignItems: 'center', justifyContent: 'center',
  },
  label: {
    fontFamily: 'HankenGrotesk_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.inkSoft, paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: 6,
  },
  input: {
    marginHorizontal: spacing.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.sm, padding: 14, fontSize: 14, color: colors.ink,
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  universityValue: { fontSize: 14, color: colors.ink },
  universityPlaceholder: { fontSize: 14, color: colors.inkSoft },
  section: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 19, color: colors.ink, paddingHorizontal: spacing.lg, marginTop: 28 },
  sectionHint: { fontSize: 13, color: colors.inkSoft, paddingHorizontal: spacing.lg, marginTop: 4 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: spacing.lg },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.coralFill, borderColor: colors.coralFill },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  chipTextOn: { color: '#FFFFFF' },
  });
}
