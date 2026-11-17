import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/ThemeContext';
import { useAuth } from '@/lib/AuthContext';
import { subscribeGuestBlocked } from '@/guest/guestState';

// Shown on every screen while the read-only demo is on. "Create account" leaves
// the demo and returns to the sign-in screen.
export default function GuestBanner() {
  const { colors } = useTheme();
  const { exitGuest } = useAuth();
  const [flash, setFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Any blocked change (post, like, message, upload) flashes the reason here.
  useEffect(() => {
    const off = subscribeGuestBlocked(() => {
      setFlash(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(false), 3500);
    });
    return () => {
      off();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  return (
    <View style={[styles.bar, { backgroundColor: flash ? colors.coral : colors.ink }]} accessibilityRole="alert">
      <Text style={[styles.text, { color: flash ? colors.ink : colors.sand }]} numberOfLines={1}>
        {flash ? 'Create an account to do this.' : 'Demo mode · sample content only'}
      </Text>
      <Pressable onPress={exitGuest} hitSlop={8} accessibilityRole="button" accessibilityLabel="Leave the demo and create an account">
        <Text style={[styles.cta, { color: flash ? colors.ink : colors.sand, textDecorationLine: 'underline' }]}>Create account</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  text: { fontFamily: 'HankenGrotesk_600SemiBold', fontSize: 12.5, flexShrink: 1 },
  cta: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 12.5 },
});
