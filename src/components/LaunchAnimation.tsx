import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useTheme } from '@/lib/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';

// Plays once per cold start: the h mark bounces in, holds, then fades into
// the exact wordmark used in Feed's top bar — landing on the real brand
// instead of a separate one-off launch graphic.
export default function LaunchAnimation({ onFinish }: { onFinish: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hScale = useRef(new Animated.Value(0)).current;
  const hOpacity = useRef(new Animated.Value(1)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkScale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(hScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      Animated.delay(450),
      Animated.parallel([
        Animated.timing(hOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(wordmarkOpacity, { toValue: 1, duration: 380, delay: 80, useNativeDriver: true }),
        Animated.spring(wordmarkScale, { toValue: 1, friction: 6, tension: 50, delay: 80, useNativeDriver: true }),
      ]),
      Animated.delay(500),
    ]).start(() => onFinish());
  }, [hScale, hOpacity, wordmarkOpacity, wordmarkScale, onFinish]);

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.h, { opacity: hOpacity, transform: [{ scale: hScale }] }]}>h</Animated.Text>
      <Animated.View style={[styles.wordmarkRow, { opacity: wordmarkOpacity, transform: [{ scale: wordmarkScale }] }]}>
        <View style={styles.dot} />
        <Text style={styles.wordmark}>havenly.</Text>
      </Animated.View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
    h: { position: 'absolute', fontFamily: 'Fraunces_700Bold_Italic', fontSize: 96, color: colors.ink },
    wordmarkRow: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral },
    wordmark: { fontFamily: 'Fraunces_700Bold_Italic', fontSize: 24, color: colors.ink },
  });
}
