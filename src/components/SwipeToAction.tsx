import React, { useRef } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/lib/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';

interface Props {
  children: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
}

const ACTION_WIDTH = 88;

// Plain PanResponder rather than react-native-gesture-handler — avoids
// adding a new native dependency (and the GestureHandlerRootView wiring
// that comes with it) for what's a small, self-contained gesture.
export default function SwipeToAction({ children, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const translateX = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);

  const close = () => {
    offset.current = 0;
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderMove: (_, gesture) => {
        const next = Math.min(0, Math.max(-ACTION_WIDTH, offset.current + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const next = offset.current + gesture.dx;
        offset.current = next < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0;
        Animated.spring(translateX, { toValue: offset.current, useNativeDriver: true, friction: 8 }).start();
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      <View style={styles.actionBackdrop}>
        <Pressable style={styles.actionBtn} onPress={() => { onAction(); close(); }} accessibilityLabel={actionLabel}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      </View>
      <Animated.View style={[styles.foreground, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { position: 'relative', overflow: 'hidden', width: '100%' },
    foreground: {
      width: '100%', backgroundColor: colors.sand,
      // Web-only: without this, a mouse drag on the row selects its text
      // instead of the PanResponder ever seeing the gesture.
      ...(Platform.OS === 'web' ? { userSelect: 'none' as const } : null),
    },
    actionBackdrop: {
      position: 'absolute', top: 0, right: 0, bottom: 0, width: ACTION_WIDTH,
      backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center',
    },
    actionBtn: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
    actionText: { color: 'white', fontWeight: '700', fontSize: 12.5 },
  });
}
