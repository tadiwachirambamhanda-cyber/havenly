import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
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
          <View style={styles.brandDot} />
          <Text style={styles.brandWordmark}>havenly.</Text>
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
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, passwordFocused && styles.inputFocused]}
            placeholder="••••••••"
            placeholderTextColor={colors.inkSoft}
            secureTextEntry
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AnimatedPressable style={styles.btnPrimary} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.btnPrimaryText}>Log in</Text>}
        </AnimatedPressable>
        <AnimatedPressable onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.switchLink}>New to Havenly? <Text style={styles.switchLinkBold}>Create an account</Text></Text>
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
  brandWordmark: { fontFamily: 'Fraunces_700Bold_Italic', fontSize: 20, color: colors.ink },
  eyebrow: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: colors.inkSoft, textTransform: 'uppercase', marginTop: 44 },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 40, color: colors.ink, marginTop: 10, lineHeight: 44 },
  rule: { height: 1, backgroundColor: colors.line, marginTop: 28, marginBottom: 26 },
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
  btnPrimary: { backgroundColor: colors.coral, paddingVertical: 16, borderRadius: 100, alignItems: 'center', marginTop: 10 },
  btnPrimaryText: { color: 'white', fontWeight: '700', fontSize: 15 },
  switchLink: { textAlign: 'center', marginTop: 18, fontSize: 13.5, color: colors.inkSoft },
  switchLinkBold: { color: colors.teal, fontWeight: '700' },
  });
}
