import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    Alert.alert('Log out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()}><Text>←</Text></Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>

      <Pressable style={styles.row} onPress={() => navigation.navigate('BlockedUsers')}>
        <Text style={styles.rowText}>Blocked accounts</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <View style={styles.divider} />

      <Pressable style={styles.row} onPress={handleLogout}>
        <Text style={[styles.rowText, styles.logoutText]}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 16, paddingHorizontal: spacing.lg },
  back: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 19, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 16 },
  rowText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  chevron: { fontSize: 18, color: colors.inkSoft },
  divider: { height: 1, backgroundColor: colors.line, marginHorizontal: spacing.lg },
  logoutText: { color: colors.coral },
});
