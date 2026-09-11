import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SignUpScreen() {
  const navigation = useNavigation<Nav>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Join Havenly</Text>
          <Text style={styles.title}>Find your people in Dubai.</Text>
          <Text style={styles.sub}>Create an account to start discovering cafés, communities, and events.</Text>
        </View>
        <View style={styles.panel}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor={colors.inkSoft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 6 characters"
            placeholderTextColor={colors.inkSoft}
            secureTextEntry
            textContentType="newPassword"
            value={password}
            onChangeText={setPassword}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {info ? <Text style={styles.info}>{info}</Text> : null}
          <Pressable style={styles.btnPrimary} onPress={handleSignUp} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.btnPrimaryText}>Create account</Text>}
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Login')}>
            <Text style={styles.switchLink}>Already have an account? <Text style={styles.switchLinkBold}>Log in</Text></Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2A2118' },
  hero: { paddingHorizontal: spacing.xl, paddingTop: 90, paddingBottom: 20 },
  eyebrow: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: '#F0C79A', textTransform: 'uppercase' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 34, color: colors.sand, marginTop: 14, lineHeight: 38 },
  sub: { fontSize: 14.5, color: '#E7D9C8', marginTop: 14, lineHeight: 21, maxWidth: 280 },
  panel: { backgroundColor: colors.sand, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, marginTop: 20, flexGrow: 1 },
  label: { fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, color: colors.inkSoft, textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.line, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: colors.ink },
  error: { color: colors.coral, fontSize: 13, marginTop: 14, lineHeight: 18 },
  info: { color: colors.teal, fontSize: 13, marginTop: 14, lineHeight: 18 },
  btnPrimary: { backgroundColor: colors.coral, paddingVertical: 16, borderRadius: 100, alignItems: 'center', marginTop: 24 },
  btnPrimaryText: { color: 'white', fontWeight: '700', fontSize: 15 },
  switchLink: { textAlign: 'center', marginTop: 18, fontSize: 13.5, color: colors.inkSoft },
  switchLinkBold: { color: colors.teal, fontWeight: '700' },
});
