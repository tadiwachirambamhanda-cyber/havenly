import React, { useEffect, useMemo, useState } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { Wordmark } from '@/components/Brand';
import { useTheme } from '@/lib/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';

// Plays once per cold start: the wordmark used in the top bars fades in quickly (about 0.4 s in all),
// so the app opens fast and lands on the real brand.
export default function LaunchAnimation({ onFinish }: { onFinish: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let finished = false;
    const finish = () => { if (!finished) { finished = true; onFinish(); } };
    const sequence = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(140),
    ]);
    sequence.start(({ finished: completed }) => { if (completed) finish(); });
    // Safety net: whatever the animation engine does, the app never waits more than a moment here.
    const safety = setTimeout(() => { sequence.stop(); finish(); }, 1500);
    return () => { clearTimeout(safety); sequence.stop(); };
  }, [opacity, onFinish]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.wordmarkRow, { opacity }]}>
        <Wordmark size={34} />
      </Animated.View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
    wordmarkRow: { flexDirection: 'row', alignItems: 'center' },
  });
}
