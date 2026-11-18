import React, { useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, TextInput as RNTextInput } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { Wordmark } from '@/components/Brand';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { useAuth } from '@/lib/AuthContext';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const { enterGuest } = useAuth();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<RNTextInput>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) setError(signInError.message);
    // On success, AuthContext picks up the new session and RootNavigator routes automatically.
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 28, paddingBottom: 40, paddingHorizontal: spacing.xl }}
      >
        <View style={styles.masthead}>
          <Wordmark size={26} />
        </View>

        <Text style={styles.eyebrow}>Member sign-in</Text>
        <Text style={styles.title}>Good to see{'\n'}you again.</Text>

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
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        </View>
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { marginBottom: 0 }]}>Password</Text>
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
              <Text style={styles.showToggle}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
          <TextInput
            ref={passwordRef}
            style={[styles.input, passwordFocused && styles.inputFocused]}
            placeholder="••••••••"
            placeholderTextColor={colors.inkSoft}
            secureTextEntry={!showPassword}
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AnimatedPressable style={styles.btnPrimary} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnPrimaryText}>Log in</Text>}
        </AnimatedPressable>
        <AnimatedPressable onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.switchLink}>New to Havenly? <Text style={styles.switchLinkBold}>Create an account</Text></Text>
        </AnimatedPressable>
        <AnimatedPressable style={styles.btnGhost} onPress={enterGuest} accessibilityRole="button" accessibilityLabel="Explore Havenly without signing up">
          <Text style={styles.btnGhostText}>Explore without signing up</Text>
          <Text style={styles.btnGhostHint}>A read-only demo with sample content</Text>
        </AnimatedPressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  masthead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral },
  brandWordmark: { fontFamily: 'SchibstedGrotesk_700Bold_Italic', fontSize: 20, color: colors.ink },
  eyebrow: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 11, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 44 },
  title: { fontFamily: 'SchibstedGrotesk_600SemiBold', fontSize: 40, color: colors.ink, marginTop: 10, lineHeight: 44 },
  rule: { height: 1, backgroundColor: colors.line, marginTop: 28, marginBottom: 26 },
  field: { marginBottom: 22 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  showToggle: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 12, color: colors.inkSoft },
  label: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 11, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  input: {
    borderBottomWidth: 1.5, borderBottomColor: colors.line, paddingVertical: 9, fontSize: 16.5, color: colors.ink,
    // react-native-web-only: suppresses the browser's default focus ring so
    // the underline-only look (via inputFocused below) reads cleanly on web.
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as const } : null),
  },
  inputFocused: { borderBottomColor: colors.coral },
  error: { color: colors.coral, fontSize: 13, marginBottom: 14, lineHeight: 18 },
  btnPrimary: { backgroundColor: colors.coral, paddingVertical: 16, borderRadius: radius.button, alignItems: 'center', marginTop: 10 },
  btnPrimaryText: { color: 'white', fontWeight: '700', fontSize: 15 },
  switchLink: { textAlign: 'center', marginTop: 18, fontSize: 13.5, color: colors.inkSoft },
  switchLinkBold: { color: colors.teal, fontWeight: '700' },
  btnGhost: { borderWidth: 1.5, borderColor: colors.line, paddingVertical: 14, borderRadius: radius.button, alignItems: 'center', marginTop: 26 },
  btnGhostText: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  btnGhostHint: { color: colors.inkSoft, fontSize: 12.5, marginTop: 3 },
  });
}
