import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/ThemeContext';
import { useAuth } from '@/lib/AuthContext';

// Shown on every screen while the read-only demo is on. "Create account" leaves
// the demo and returns to the sign-in screen.
export default function GuestBanner() {
  const { colors } = useTheme();
  const { exitGuest } = useAuth();
  return (
    <View style={[styles.bar, { backgroundColor: colors.ink }]} accessibilityRole="alert">
      <Text style={[styles.text, { color: colors.sand }]} numberOfLines={1}>
        Demo mode · sample content only
      </Text>
      <Pressable onPress={exitGuest} hitSlop={8} accessibilityRole="button" accessibilityLabel="Leave the demo and create an account">
        <Text style={[styles.cta, { color: colors.coral }]}>Create account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  text: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12.5, flexShrink: 1 },
  cta: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 12.5 },
});
