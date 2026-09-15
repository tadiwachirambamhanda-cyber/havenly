import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { useConfirmDiscard } from '@/lib/useConfirmDiscard';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import { INTEREST_OPTIONS } from '@/constants/interests';
import { interestIcon } from '@/constants/topicIcons';
import UniversityPickerModal from '@/components/UniversityPickerModal';
import type { Interest } from '@/types';

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
  const [interests, setInterests] = useState<Set<Interest>>(new Set(profile?.interests ?? []));
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url ?? null);
  const [newAvatarPicked, setNewAvatarPicked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [universityPickerVisible, setUniversityPickerVisible] = useState(false);

  const interestsChanged = interests.size !== (profile?.interests ?? []).length
    || Array.from(interests).some((k) => !profile?.interests.includes(k));
  useConfirmDiscard(!saved && (
    displayName !== (profile?.display_name ?? '')
    || username !== (profile?.username ?? '')
    || bio !== (profile?.bio ?? '')
    || university !== (profile?.university ?? '')
    || newAvatarPicked
    || interestsChanged
  ));

  const toggleInterest = (key: Interest) => {
    setInterests((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

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
        interests: Array.from(interests),
        avatar_url: avatarUrl,
      }).eq('id', session.user.id);

      if (updateError) {
        if (updateError.code === '23505') throw new Error('That username is already taken.');
        throw updateError;
      }

      await refreshProfile();
      haptics.success();
      setSaved(true);
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
        <Pressable onPress={() => navigation.goBack()} accessibilityLabel="Cancel"><Text style={styles.headerBtn}>Cancel</Text></Pressable>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <Pressable onPress={save} disabled={saving} accessibilityLabel="Save profile">
          {saving ? <ActivityIndicator color={colors.coral} /> : <Text style={[styles.headerBtn, styles.saveBtn]}>Save</Text>}
        </Pressable>
      </View>

      <Pressable style={styles.avatarWrap} onPress={pickAvatar} accessibilityLabel="Change profile photo">
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} transition={200} />
        ) : (
          <LinearGradient colors={['#0F8B82', '#FF5A3C']} style={styles.avatar} />
        )}
        <Text style={styles.changePhoto}>Change photo</Text>
      </Pressable>

      <Text style={styles.label}>Display name</Text>
      <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Your name" placeholderTextColor={colors.inkSoft} />

      <Text style={styles.label}>Username</Text>
      <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="username" placeholderTextColor={colors.inkSoft} />

      <Text style={styles.label}>Bio</Text>
      <TextInput style={[styles.input, styles.bioInput]} value={bio} onChangeText={setBio} multiline placeholder="Tell people a bit about you" placeholderTextColor={colors.inkSoft} />

      <Text style={styles.label}>University</Text>
      <Pressable style={styles.input} onPress={() => setUniversityPickerVisible(true)}>
        <Text style={university ? styles.universityValue : styles.universityPlaceholder}>
          {university || 'Select your university'}
        </Text>
      </Pressable>
      <UniversityPickerModal
        visible={universityPickerVisible}
        selected={university || null}
        onClose={() => setUniversityPickerVisible(false)}
        onSelect={(name) => setUniversity(name ?? '')}
      />

      <Text style={styles.label}>Interests</Text>
      <View style={styles.chipGrid}>
        {INTEREST_OPTIONS.map((opt) => {
          const isSelected = interests.has(opt.key);
          return (
            <Pressable key={opt.key} style={[styles.chip, isSelected && styles.chipSelected]} onPress={() => { haptics.tap(); toggleInterest(opt.key); }}>
              <Feather name={interestIcon(opt.key)} size={13} color={isSelected ? colors.sand : colors.ink} />
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 17, color: colors.ink },
  headerBtn: { fontSize: 14, fontWeight: '600', color: colors.inkSoft },
  saveBtn: { color: colors.coral, fontWeight: '700' },
  avatarWrap: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  changePhoto: { marginTop: 8, fontSize: 12.5, fontWeight: '700', color: colors.teal },
  label: {
    fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft,
    fontWeight: '600', paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: 6,
  },
  input: {
    marginHorizontal: spacing.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.sm, padding: 14, fontSize: 14, color: colors.ink,
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  universityValue: { fontSize: 14, color: colors.ink },
  universityPlaceholder: { fontSize: 14, color: colors.inkSoft },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingHorizontal: spacing.lg },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12.5, fontWeight: '600', color: colors.ink },
  chipTextSelected: { color: colors.sand },
  error: { color: colors.coral, fontSize: 13, marginTop: 16, marginHorizontal: spacing.lg },
  });
}
