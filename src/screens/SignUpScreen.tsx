import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SignUpScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSignUp = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Enter an email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (!data.session) {
      // Email confirmation is turned on for this Supabase project.
      setInfo('Account created. Check your inbox to confirm your email, then log in.');
      return;
    }
    // On success, AuthContext picks up the new session and RootNavigator routes to Onboarding.
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 28, paddingBottom: 40, paddingHorizontal: spacing.xl }}
      >
        <View style={styles.masthead}>
          <View style={styles.brandDot} />
          <Text style={styles.brandWordmark}>havenly.</Text>
        </View>

        <Text style={styles.eyebrow}>Join Havenly</Text>
        <Text style={styles.title}>Made for students in Dubai.</Text>
        <Text style={styles.sub}>Events, cafés, student perks and rooms near campus, posted by other students.</Text>

        <View style={styles.rule} />

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, emailFocused && styles.inputFocused]}
            placeholder="you@example.com"
            placeholderTextColor={colors.inkSoft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, passwordFocused && styles.inputFocused]}
            placeholder="At least 6 characters"
            placeholderTextColor={colors.inkSoft}
            secureTextEntry
            textContentType="newPassword"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}

        <AnimatedPressable style={styles.btnPrimary} onPress={handleSignUp} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnPrimaryText}>Create account</Text>}
        </AnimatedPressable>
        <AnimatedPressable onPress={() => navigation.navigate('Login')}>
          <Text style={styles.switchLink}>Already have an account? <Text style={styles.switchLinkBold}>Log in</Text></Text>
        </AnimatedPressable>
        <Text style={styles.legalNote}>
          By creating an account you agree to our{' '}
          <Text style={styles.legalLink} onPress={() => navigation.navigate('Legal', { doc: 'terms' })} accessibilityRole="link">Terms of use</Text>
          {' '}and{' '}
          <Text style={styles.legalLink} onPress={() => navigation.navigate('Legal', { doc: 'privacy' })} accessibilityRole="link">Privacy policy</Text>.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  legalNote: { fontSize: 12, lineHeight: 18, color: colors.inkSoft, textAlign: 'center', marginTop: 18 },
  legalLink: { color: colors.ink, fontWeight: '700', textDecorationLine: 'underline' },
  container: { flex: 1, backgroundColor: colors.sand },
  masthead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral },
  brandWordmark: { fontFamily: 'Fraunces_700Bold_Italic', fontSize: 20, color: colors.ink },
  eyebrow: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: colors.inkSoft, textTransform: 'uppercase', marginTop: 44 },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 38, color: colors.ink, marginTop: 10, lineHeight: 42 },
  sub: { fontSize: 14.5, color: colors.inkSoft, marginTop: 12, lineHeight: 21, maxWidth: 280 },
  rule: { height: 1, backgroundColor: colors.line, marginTop: 26, marginBottom: 24 },
  field: { marginBottom: 22 },
  label: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: colors.inkSoft, textTransform: 'uppercase', marginBottom: 8 },
  input: {
    borderBottomWidth: 1.5, borderBottomColor: colors.line, paddingVertical: 9, fontSize: 16.5, color: colors.ink,
    // react-native-web-only: suppresses the browser's default focus ring so
    // the underline-only look (via inputFocused below) reads cleanly on web.
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as const } : null),
  },
  inputFocused: { borderBottomColor: colors.coral },
  error: { color: colors.coral, fontSize: 13, marginBottom: 14, lineHeight: 18 },
  info: { color: colors.teal, fontSize: 13, marginBottom: 14, lineHeight: 18 },
  btnPrimary: { backgroundColor: colors.coral, paddingVertical: 16, borderRadius: radius.button, alignItems: 'center', marginTop: 10 },
  btnPrimaryText: { color: 'white', fontWeight: '700', fontSize: 15 },
  switchLink: { textAlign: 'center', marginTop: 18, fontSize: 13.5, color: colors.inkSoft },
  switchLinkBold: { color: colors.teal, fontWeight: '700' },
  });
}
