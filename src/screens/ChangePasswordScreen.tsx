import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import BackButton from '@/components/BackButton';
import AnimatedPressable from '@/components/AnimatedPressable';
import { Notice, PrimaryButton } from '@/components/housing/parts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { PASSWORD_HINT, passwordProblem } from '@/lib/passwordRules';
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';

export default function ChangePasswordScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    if (password !== confirm) return setError('The two passwords do not match.');
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      const msg = updateError.message ?? '';
      if (/same|different/i.test(msg)) return setError('Choose a password you have not used for this account before.');
      if (/reauth|recent|session/i.test(msg)) return setError('For your safety, log out and log back in, then change your password.');
      return setError('We could not change your password. Check your connection and try again.');
    }
    haptics.success();
    showToast('Password changed');
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <BackButton style={styles.back}><Icon name="arrow-left" size={17} color={colors.ink} /></BackButton>
          <Text style={styles.title} accessibilityRole="header">Change password</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 14 }} keyboardShouldPersistTaps="handled">
          {isGuest ? <Notice kind="note">Demo mode shows this screen only. Make an account to change a password.</Notice> : null}

          <View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>New password</Text>
              <AnimatedPressable onPress={() => setShow((v) => !v)} accessibilityRole="button" accessibilityLabel={show ? 'Hide passwords' : 'Show passwords'}>
                <Text style={styles.show}>{show ? 'Hide' : 'Show'}</Text>
              </AnimatedPressable>
            </View>
            <TextInput
              style={styles.field}
              placeholder={PASSWORD_HINT}
              placeholderTextColor="#6B655A"
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
              accessibilityLabel="New password"
              maxLength={72}
            />
          </View>

          <View>
            <Text style={styles.label}>Repeat the new password</Text>
            <TextInput
              style={styles.field}
              placeholder="Type it again"
              placeholderTextColor="#6B655A"
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="new-password"
              value={confirm}
              onChangeText={setConfirm}
              onSubmitEditing={save}
              returnKeyType="done"
              accessibilityLabel="Repeat the new password"
              maxLength={72}
            />
          </View>

          {error ? <Notice>{error}</Notice> : null}

          <PrimaryButton label="Change password" onPress={save} loading={saving} disabled={isGuest || !password || !confirm} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12, paddingHorizontal: spacing.lg },
    back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 24, letterSpacing: -0.4, color: colors.ink },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    label: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, color: colors.inkSoft, marginBottom: 6 },
    show: { fontSize: 14, fontWeight: '700', color: colors.coral, minHeight: 32 },
    field: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white, paddingHorizontal: 14, fontSize: 16, color: colors.ink },
  });
}
