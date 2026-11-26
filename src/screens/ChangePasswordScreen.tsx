import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { useNavigation } from '@react-navigation/native';
import ScreenHeader from '@/components/ScreenHeader';
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
        <ScreenHeader title="Change password" />
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 40, gap: 16 }} keyboardShouldPersistTaps="handled">
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
              placeholderTextColor={colors.inkSoft}
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
              placeholderTextColor={colors.inkSoft}
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
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    label: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.inkSoft, marginBottom: 6 },
    show: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, color: colors.coral, minHeight: 32 },
    field: { height: 54, borderRadius: 16, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white, paddingHorizontal: 14, fontSize: 16, color: colors.ink },
  });
}
