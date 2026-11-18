import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, type TextInputInstance } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AnimatedPressable from '@/components/AnimatedPressable';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { PASSWORD_HINT, passwordProblem } from '@/lib/passwordRules';
import { Notice, PrimaryButton, SheetHeader } from '@/components/housing/parts';
import { clearPendingReturn, setPendingReturn } from '@/components/housing/pendingReturn';
import type { ColorTokens } from '@/theme/tokens';
import type { AccountReason, RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'SignInToContinue'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

const TITLE: Record<AccountReason, string> = {
  enquire: 'Make a free account to send your enquiry',
  save: 'Make a free account to save places',
  compare: 'Make a free account to compare places',
  join: 'Make a free account',
  login: 'Welcome back',
};

const WHY: Record<AccountReason, string> = {
  enquire: 'So the Havenly team and the provider can reach you about this place.',
  save: 'So your saved places are kept for you on any device.',
  compare: 'So the places you compare are kept for you.',
  join: 'So you can save places, send enquiries and join in.',
  login: 'Log in to see your saved places and your enquiries.',
};

export default function SignInToContinueScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { reason, residenceId } = route.params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [mode, setMode] = useState<'create' | 'login'>(reason === 'login' ? 'login' : 'create');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const { enterGuest } = useAuth();

  // Once there is an account, the visitor lands back on this listing (see HousingScreen).
  useEffect(() => {
    if (residenceId) setPendingReturn(residenceId);
  }, [residenceId]);

  const close = () => {
    clearPendingReturn();
    navigation.goBack();
  };

  const submit = async () => {
    setError(null);
    setInfo(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Enter your email and a password.');
      return;
    }
    if (mode === 'create') {
      const problem = passwordProblem(password);
      if (problem) {
        setError('Use at least 8 characters, with a capital letter, a small letter and a number.');
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === 'create') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: cleanEmail, password });
        if (signUpError) { setError(signUpError.message); return; }
        if (!data.session) setInfo('Account created. Check your inbox to confirm your email, then log in.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (signInError) setError('That email and password do not match. Check them and try again.');
      }
      // On success the app picks up the new session and moves on by itself.
    } catch {
      setError('We could not reach Havenly. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
        <SheetHeader title={mode === 'create' ? 'Make an account to continue' : 'Log in to continue'} onClose={close} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20, gap: 14 }} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 6 }}>
            <Text style={styles.heading}>{TITLE[reason]}</Text>
            <Text style={styles.body}>
              {WHY[reason]}{reason === 'login' ? '' : residenceId ? ' It takes a minute, and you stay on this listing afterwards.' : ' It takes a minute.'}
            </Text>
          </View>

          <View>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.field}
              placeholder="you@example.com"
              placeholderTextColor="#6B655A"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Email"
              maxLength={254}
            />
          </View>

          <View>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Password</Text>
              <AnimatedPressable onPress={() => setShowPassword((v) => !v)} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} style={styles.showBtn}>
                <Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </AnimatedPressable>
            </View>
            <TextInput
              ref={passwordRef}
              style={[styles.field, error ? styles.fieldBad : null]}
              placeholder={mode === 'create' ? PASSWORD_HINT : 'Your password'}
              placeholderTextColor="#6B655A"
              secureTextEntry={!showPassword}
              textContentType={mode === 'create' ? 'newPassword' : 'password'}
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              value={password}
              onChangeText={setPassword}
              returnKeyType="go"
              onSubmitEditing={submit}
              accessibilityLabel="Password"
              maxLength={72}
            />
            {mode === 'create' ? <Text style={styles.rule}>At least 8 characters, with a capital letter, a small letter and a number.</Text> : null}
          </View>

          {error ? <Notice>{error}</Notice> : null}
          {info ? <Notice kind="note">{info}</Notice> : null}
          {busy ? <Notice kind="note">{mode === 'create' ? 'Creating your account...' : 'Logging you in...'}{residenceId ? ' You will go straight back to the listing you were on.' : ''}</Notice> : null}

          <PrimaryButton label={mode === 'create' ? 'Create account' : 'Log in'} onPress={submit} loading={busy} />
          <AnimatedPressable
            style={styles.linkBtn}
            onPress={() => { setError(null); setInfo(null); setMode((m) => (m === 'create' ? 'login' : 'create')); }}
            accessibilityRole="button"
          >
            <Text style={styles.link}>{mode === 'create' ? 'I already have an account. Log in' : 'I need a new account. Create one'}</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.linkBtn} onPress={close} accessibilityRole="button" accessibilityLabel="Not now">
            <Text style={styles.link}>Not now</Text>
          </AnimatedPressable>
          {reason === 'join' || reason === 'login' ? (
            <AnimatedPressable style={styles.linkBtn} onPress={enterGuest} accessibilityRole="button" accessibilityLabel="Explore Havenly without signing up, a read-only demo with sample content">
              <Text style={styles.link}>Just looking? Explore the demo</Text>
            </AnimatedPressable>
          ) : null}

          <Text style={styles.legal}>
            By creating an account you agree to the{' '}
            <Text style={styles.legalLink} onPress={() => navigation.navigate('Legal', { doc: 'terms' })} accessibilityRole="link">Terms of use</Text>
            {' '}and the{' '}
            <Text style={styles.legalLink} onPress={() => navigation.navigate('Legal', { doc: 'privacy' })} accessibilityRole="link">Privacy policy</Text>.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: '#7A756B', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.sand, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '96%', width: '100%' },
    heading: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 22, lineHeight: 27, color: colors.ink },
    body: { fontSize: 15, lineHeight: 21, color: colors.inkBody },
    label: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 13, color: colors.ink, marginBottom: 6 },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    showBtn: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', marginTop: -12 },
    showText: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 14, color: colors.coral },
    field: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white, paddingHorizontal: 14, fontSize: 16, color: colors.ink, outlineStyle: 'none' } as never,
    fieldBad: { borderColor: colors.errorText, borderWidth: 2 },
    rule: { fontSize: 13, color: colors.inkMuted, marginTop: 6 },
    linkBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    link: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 15, color: colors.ink, textDecorationLine: 'underline' },
    legal: { fontSize: 12, lineHeight: 17, color: colors.inkMuted, textAlign: 'center' },
    legalLink: { textDecorationLine: 'underline', color: colors.ink },
  });
}
