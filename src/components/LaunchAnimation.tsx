import React, { useEffect, useMemo, useState } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { RoofH, Wordmark } from '@/components/Brand';
import { useTheme } from '@/lib/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';

// Plays once per cold start: the roof-h mark bounces in, holds, then fades into
// the exact wordmark used in the top bars — landing on the real brand instead of
// a separate one-off launch graphic.
export default function LaunchAnimation({ onFinish }: { onFinish: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [hScale] = useState(() => new Animated.Value(0));
  const [hOpacity] = useState(() => new Animated.Value(1));
  const [wordmarkOpacity] = useState(() => new Animated.Value(0));
  const [wordmarkScale] = useState(() => new Animated.Value(0.85));

  useEffect(() => {
    Animated.sequence([
      Animated.timing(hScale, { toValue: 1, duration: 520, easing: Easing.out(Easing.back(1.7)), useNativeDriver: true }),
      Animated.delay(450),
      Animated.parallel([
        Animated.timing(hOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(wordmarkOpacity, { toValue: 1, duration: 380, delay: 80, useNativeDriver: true }),
        Animated.timing(wordmarkScale, { toValue: 1, duration: 420, delay: 80, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      ]),
      Animated.delay(500),
    ]).start(() => onFinish());
    // Safety net: whatever the animation engine does, the app never waits more than a few seconds here.
    const safety = setTimeout(onFinish, 4000);
    return () => clearTimeout(safety);
  }, [hScale, hOpacity, wordmarkOpacity, wordmarkScale, onFinish]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.h, { opacity: hOpacity, transform: [{ scale: hScale }] }]}>
        <RoofH size={96} />
      </Animated.View>
      <Animated.View style={[styles.wordmarkRow, { opacity: wordmarkOpacity, transform: [{ scale: wordmarkScale }] }]}>
        <Wordmark size={34} />
      </Animated.View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
    h: { position: 'absolute' },
    wordmarkRow: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
  });
}
